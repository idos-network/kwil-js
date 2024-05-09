import { Base64String, HexString } from "../utils/types";
import { Database } from "./database";
import { BroadcastSyncType, BytesEncodingStatus } from "./enums";
import { MsgData } from "./message";
import { ChainInfo, DatasetInfoServer } from "./network";
import { TxnData } from "./tx";
import { TxResult } from "./txQuery";

export interface JsonRPCRequest<T> {
    jsonrpc: string;
    id: number;
    method: JSONRPCMethod;
    params: T;
}

export enum JSONRPCMethod {
    // TODO: Should we implement version? It hasn't historically existed on Kwil-JS, but i notice it in kwil-db.
    METHOD_PING = 'user.ping',
    METHOD_CHAIN_INFO = 'user.chain_info',
    METHOD_ACCOUNT = 'user.account',
    METHOD_BROADCAST = 'user.broadcast',
    METHOD_CALL = 'user.call',
    METHOD_DATABASES = 'user.databases',
    METHOD_PRICE = 'user.estimate_price',
    METHOD_QUERY = 'user.query',
    METHOD_TX_QUERY = 'user.tx_query',
    METHOD_SCHEMA = 'user.schema',
}

export interface SchemaRequest {
    dbid: string;
}

export interface AccountRequest {
    identifier: HexString;
    status: AccountStatus;
}

// For checking the unconfirmed nonce
export enum AccountStatus {
    // returns the latest confirmed nonce
    LATEST = 0,
    // returns the latest unconfirmed nonce
    PENDING = 1,
}

export interface BroadcastRequest {
    tx: TxnData<BytesEncodingStatus.BASE64_ENCODED>;
    sync?: BroadcastSyncType;
}

export type CallRequest = MsgData<BytesEncodingStatus.BASE64_ENCODED>;

export interface ChainInfoRequest {
    [key: string]: never;
}

export interface ListDatabasesRequest {
    owner?: HexString;
}

export interface PingRequest {
    message: string;
}

export interface EstimatePriceRequest {
    tx: TxnData<BytesEncodingStatus.BASE64_ENCODED>;
}

export interface QueryRequest {
    dbid: string;
    query: string;
}

export interface TxQueryRequest {
    tx_hash: string;
}

export interface JsonRPCResponse<T> {
    jsonrpc: string;
    id: number;
    result: T;
    error?: JsonRPCError;
}

interface JsonRPCError {
    code: number;
    message: string;
    data?: object;
}

export interface SchemaResponse {
    schema: Database & {
        owner: string;
    }
}

export interface AccountResponse {
    identifier?: HexString;
    balance: string;
    nonce: number;
}

export interface BroadcastResponse {
    tx_hash: Base64String;
}

export type CallResponse = Result;
export type QueryResponse = Result;

interface Result {
    result: Base64String;
}

export type ChainInfoResponse = ChainInfo;

export interface ListDatabasesResponse {
    databases: DatasetInfoServer[];
}

export interface PingResponse {
    message: string;
}

export interface EstimatePriceResponse {
    price: string;
}

export interface TxQueryResponse {
    hash: string;
    height: number;
    tx: TxnData<BytesEncodingStatus.BASE64_ENCODED>;
    tx_result: TxResult;
}