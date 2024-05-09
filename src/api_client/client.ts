import { base64ToBytes, bytesToBase64 } from '../utils/base64';
import { Account, ChainInfo, DatasetInfo } from '../core/network';
import { Database, SelectQuery } from '../core/database';
import { Transaction, TxReceipt } from '../core/tx';
import { Api } from './api';
import { ClientConfig } from './config';
import {
  CallRes,
  EstimateCostRes,
  GenericResponse,
  GetAuthResponse,
  ListDatabasesResponse,
  PostAuthResponse,
  SelectRes,
} from '../core/resreq';
import { base64ToHex, bytesToHex, bytesToString, hexToBase64, hexToBytes } from '../utils/serial';
import { TxInfoReceipt } from '../core/txQuery';
import { Message, MsgData, MsgReceipt } from '../core/message';
import { kwilDecode } from '../utils/rlp';
import { BroadcastSyncType, BytesEncodingStatus, EnvironmentType } from '../core/enums';
import { AuthInfo, AuthSuccess, AuthenticatedBody, LogoutResponse } from '../core/auth';
import { AxiosResponse } from 'axios';
import { AccountRequest, AccountResponse, AccountStatus, BroadcastRequest, BroadcastResponse, CallRequest, CallResponse, ChainInfoRequest, ChainInfoResponse, EstimatePriceRequest, JSONRPCMethod, JsonRPCRequest, JsonRPCResponse, ListDatabasesRequest, PingRequest, PingResponse, QueryRequest, SchemaRequest, SchemaResponse, TxQueryRequest, TxQueryResponse } from '../core/jsonrpc';

export default class Client extends Api {
  private unconfirmedNonce: boolean;
  private jsonRpcId: number = 1;

  constructor(opts: ClientConfig) {
    super(opts);
    this.unconfirmedNonce = opts.unconfirmedNonce || false;
  }

  protected async getSchemaClient(dbid: string): Promise<GenericResponse<Database>> {
    const body = this.buildJsonRpcRequest<SchemaRequest>(
      JSONRPCMethod.METHOD_SCHEMA,
      { dbid }
    );

    const res = await super.post<JsonRPCResponse<SchemaResponse>>(`/rpc/v1`, body);

    return checkRes(res, (r) => {
      return {
        ...r.result.schema,
        owner: hexToBytes(r.result.schema.owner || ''),
      };
    });
  }

  // TODO: Update once KGW is updated for JSON RPC - DO NOT MERGE WITHOUT RESOLVING
  protected async getAuthenticateClient(): Promise<GenericResponse<AuthInfo>> {
    const res = await super.get<GetAuthResponse>(`/auth`);
    // @ts-ignore
    return checkRes(res, (r) => r.result);
  }

  // TODO: Update once KGW is updated for JSON RPC - DO NOT MERGE WITHOUT RESOLVING
  protected async postAuthenticateClient<T extends EnvironmentType>(
    body: AuthenticatedBody<BytesEncodingStatus.BASE64_ENCODED>
  ): Promise<GenericResponse<AuthSuccess<T>>> {
    const res = await super.post<PostAuthResponse>(`/auth`, body);
    // @ts-ignore - DO NOT MERGE WITHOUT RESOLVING
    checkRes(res);
    
    if (typeof window === 'undefined') {
      const cookie = res.headers['set-cookie'];
      if (!cookie) {
        throw new Error('No cookie received from gateway. An error occured with authentication.');
      }

      // set the cookie
      this.cookie = cookie[0];

      // if we are in nodejs, we need to return the cookie
      return {
        status: res.status,
        // @ts-ignore
        data: {
          result: res.data.result,
          cookie: cookie[0],
        },
      };
    }

    // if we are in the browser, we don't need to return the cookie
    return {
      status: res.status,
      data: {
        result: res.data.result,
      },
    };
  }

  // TODO: Update once KGW is updated for JSON RPC - DO NOT MERGE WITHOUT RESOLVING
  protected async logoutClient<T extends EnvironmentType>(): Promise<
    GenericResponse<LogoutResponse<T>>
  > {
    const res = await super.get<LogoutResponse<T>>(`/logout`);
    // @ts-ignore - DO NOT MERGE WITHOUT RESOLVING
    checkRes(res);

    // remove the cookie
    this.cookie = undefined;

    // if we are in nodejs, we need to return the cookie
    if (typeof window === 'undefined') {
      const cookie = res.headers['set-cookie'];
      if (!cookie) {
        throw new Error('No cookie received from gateway. An error occured with authentication.');
      }

      return {
        status: res.status,
        // @ts-ignore
        data: {
          result: res.data.result,
          cookie: cookie[0],
        },
      };
    }

    // if we are in the browser, we don't need to return the cookie - the browser will handle it
    return {
      status: res.status,
      data: {
        result: res.data.result,
      },
    };
  }

  protected async getAccountClient(owner: Uint8Array): Promise<GenericResponse<Account>> {
    const body = this.buildJsonRpcRequest<AccountRequest>(
      JSONRPCMethod.METHOD_ACCOUNT,
      {
        identifier: bytesToHex(owner),
        status: this.unconfirmedNonce ? AccountStatus.PENDING : AccountStatus.LATEST
      }
    );

    const res = await super.post<JsonRPCResponse<AccountResponse>>(`/rpc/v1`, body);

    return checkRes(res, (r) => {
      return {
        ...r.result,
        identifier: hexToBytes(r.result.identifier || ''),
      }
    });
  }

  protected async listDatabasesClient(owner?: Uint8Array): Promise<GenericResponse<DatasetInfo[]>> {
    const body = this.buildJsonRpcRequest<ListDatabasesRequest>(
      JSONRPCMethod.METHOD_DATABASES,
      { owner: owner ? bytesToHex(owner) : undefined }
    );

    const res = await super.post<JsonRPCResponse<ListDatabasesResponse>>(`/rpc/v1`, body);

    return checkRes(res, (r) => {
      if (!r.result.databases) {
        return [];
      }

      return r.result.databases.map((db) => {
        return {
          ...db,
          owner: hexToBytes(db.owner),
        };
      });
    });
  }

  protected async estimateCostClient(tx: Transaction): Promise<GenericResponse<string>> {
    const body = this.buildJsonRpcRequest<EstimatePriceRequest>(
      JSONRPCMethod.METHOD_PRICE,
      { tx: tx.txData }
    )

    const res = await super.post<JsonRPCResponse<EstimateCostRes>>(`/rpc/v1`, body);

    return checkRes(res, (r) => r.result.price);
  }

  protected async broadcastClient(
    tx: Transaction,
    broadcastSync?: BroadcastSyncType
  ): Promise<GenericResponse<TxReceipt>> {
    if (!tx.isSigned()) {
      throw new Error('Tx must be signed before broadcasting.');
    }

    const body = this.buildJsonRpcRequest<BroadcastRequest>(
      JSONRPCMethod.METHOD_BROADCAST,
      { tx: tx.txData, ...(broadcastSync ? { sync: broadcastSync } : {}) }
    )

    const res = await super.post<JsonRPCResponse<BroadcastResponse>>(`/rpc/v1`, body);

    return checkRes(res, (r) => {
      return {
        tx_hash: base64ToHex(r.result.tx_hash),
      }
    });
  }

  protected async pingClient(): Promise<GenericResponse<string>> {
    const body = this.buildJsonRpcRequest<PingRequest>(
      JSONRPCMethod.METHOD_PING,
      { message: 'ping' }
    )

    const res = await super.post<JsonRPCResponse<PingResponse>>(`/rpc/v1`, body);

    return checkRes(res, (r) => r.result.message);
  }

  protected async chainInfoClient(): Promise<GenericResponse<ChainInfo>> {
    const body = this.buildJsonRpcRequest<ChainInfoRequest>(
      JSONRPCMethod.METHOD_CHAIN_INFO,
      {}
    )

    const res = await super.post<JsonRPCResponse<ChainInfoResponse>>(`/rpc/v1`, body);

    return checkRes(res, (r) => r.result);
  }

  protected async selectQueryClient(query: SelectQuery): Promise<GenericResponse<string>> {
    const body = this.buildJsonRpcRequest<QueryRequest>(
      JSONRPCMethod.METHOD_QUERY,
      query
    )

    const res = await super.post<JsonRPCResponse<SelectRes>>(`/rpc/v1`, body);

    return checkRes(res, (r) => r.result.result);
  }

  protected async txInfoClient(tx_hash: string): Promise<GenericResponse<TxInfoReceipt>> {
    const body = this.buildJsonRpcRequest<TxQueryRequest>(
      JSONRPCMethod.METHOD_TX_QUERY,
      { tx_hash: hexToBase64(tx_hash) }
    )

    const res = await super.post<JsonRPCResponse<TxQueryResponse>>(`/rpc/v1`, body);

    return checkRes(res, (r) => {
      return {
        ...r.result,
        hash: base64ToHex(r.result.hash),
        tx: {
          ...r.result.tx,
          body: {
            ...r.result.tx.body,
            payload: kwilDecode(base64ToBytes(r.result.tx.body.payload as string)),
          },
          signature: {
            ...r.result.tx.signature,
            sig: base64ToBytes(r.result.tx.signature.sig as string),
          },
          sender: hexToBytes(r.result.tx.sender || ''),
        }
      }
    });
  }

  protected async callClient(msg: Message): Promise<GenericResponse<MsgReceipt>> {
    const body = this.buildJsonRpcRequest<CallRequest>(
      JSONRPCMethod.METHOD_CALL,
      { 
        body: msg.body,
        auth_type: msg.auth_type,
        sender: msg.sender || '',
      }
    )

    const res = await super.post<JsonRPCResponse<CallResponse>>(`rpc/v1`, body)

    // if we get a 401, we need to return the response so we can try to authenticate
    if (res.status === 401) {
      return {
        status: res.status,
        data: JSON.parse(bytesToString(base64ToBytes(res.data.result.result))),
      }
    }

    return checkRes(res, (r) => {
      return {
        result: JSON.parse(bytesToString(base64ToBytes(r.result.result)))
      }
    });
  }

  private buildJsonRpcRequest<T>(method: JSONRPCMethod, params: T): JsonRPCRequest<T> {
    return {
      jsonrpc: '2.0',
      id: this.jsonRpcId++,
      method,
      params,
    };
  }
}

function checkRes<T, R>(
  res: AxiosResponse<JsonRPCResponse<T>>,
  selector: (r: JsonRPCResponse<T>) => R | undefined
): GenericResponse<R> {

  switch (res.status) {
    case 200:
      break;
    case 401:
      throw new Error(JSON.stringify(res.data) || 'Unauthorized.');
    case 404:
      throw new Error(JSON.stringify(res.data) || 'Not found.');
    case 500:
      throw new Error(JSON.stringify(res.data) || 'Internal server error.');
    default:
      throw new Error(
        JSON.stringify(res.data) ||
        'An unknown error has occurred.  Please check your network connection.'
      );
  }

  if (!res.data) {
    throw new Error(`failed to parse response: ${res}`);
  }

  if (res.data.error) {
    const data = res.data.error.data ? `, data: ${JSON.stringify(res.data.error.data)}` : '';
    throw new Error(`JSON RPC call error: code: ${res.data.error.code}, message: ${res.data.error.message}` + data);
  }

  if (res.data.jsonrpc !== '2.0') {
    throw new Error(JSON.stringify(res.data) || 'Invalid JSON RPC response.');
  }

  if (!res.data.result) {
    throw new Error(JSON.stringify(res.data) || 'No result in JSON RPC response.');
  }

  return {
    status: res.status,
    data: selector(res.data),
  };
}
