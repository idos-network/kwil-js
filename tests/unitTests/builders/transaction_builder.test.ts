import { getMock, postMock } from '../api_client/api-utils';
import { TxnBuilderImpl } from '../../../src/builders/transaction_builder';
import { TxnBuilder } from '../../../src/core/builders';
import { Kwil } from '../../../src/client/kwil';
import { PayloadType, Transaction } from '../../../src/core/tx';
import { Wallet } from 'ethers';

class TestKwil extends Kwil {
    constructor() {
        super({kwilProvider: 'doesnt matter' })
    }
}

describe('Transaction Builder', () => {
    let txBuilder: TxnBuilder;
    let mockKwil = new TestKwil();

    beforeEach(() => {
        txBuilder = TxnBuilderImpl.of(mockKwil);
        getMock.mockReset();
        postMock.mockReset();
    });

    describe('of', () => {
        it('should return a TxnBuilderImpl', () => {
            const result = TxnBuilderImpl.of(mockKwil);
            expect(result).toBeInstanceOf(TxnBuilderImpl);
        });
    })

    describe('payload', () => {
        it('should set the payloadand return TxnBuilderImpl', () => {
            const result = txBuilder.payload({foo: 'bar'});
            expect(result).toBeInstanceOf(TxnBuilderImpl);
            expect((result as any)._payload).toBeDefined();
        });
    })

    describe('payloadType', () => {
        it('should set the payloadType and return TxnBuilderImpl', () => {
            const result = txBuilder.payloadType(PayloadType.DEPLOY_DATABASE);
            expect(result).toBeInstanceOf(TxnBuilderImpl);
            expect((result as any)._payloadType).toBe(101);
        })
    })

    describe('signer', () => {
        it('should set the signer and return TxnBuilderImpl', () => {
            const sig = Wallet.createRandom();
            const result = txBuilder.signer(sig);
            expect(result).toBeInstanceOf(TxnBuilderImpl);
            expect((result as any)._signer).toBe(sig);
        });
    });

    describe('build', () => {
        it('should build a transaction', async () => {
            const wallet = Wallet.createRandom()

            const mockedAccount = {
                address: wallet.address,
                balance: "10000000000000000",
                nonce: 1
            }

            getMock.mockResolvedValueOnce({
                status: 200,
                data: {
                    account: mockedAccount
                }
            })
            
            postMock.mockResolvedValueOnce({
                status: 200,
                data: {
                    price: "100000"
                }
            });

            const result = await txBuilder
                .payload({foo: 'bar'})
                .payloadType(PayloadType.DEPLOY_DATABASE)
                .signer(wallet)
                .build();

            const extRes = {
                hash: 'kWBaCs+MeotmBuOMSKJFxsDaA2r0yIBmv9ljdMIHRnc8vbVfkY4Hg4uTvYfYJitM',
                payload_type: 101,
                payload: 'eyJmb28iOiJiYXIifQ==',
                fee: '100000',
                nonce: 2,
                signature: {
                  signature_bytes: 'string',
                  signature_type: 2
                },
                sender: wallet.address
              }
            expect(result).toBeInstanceOf(Transaction);
            expect(result.hash).toBe(extRes.hash);
            expect(result.payload_type).toBe(extRes.payload_type);
            expect(result.payload).toBe(extRes.payload);
            expect(result.fee).toBe(extRes.fee);
            expect(result.nonce).toBe(extRes.nonce);
            expect(result.signature.signature_type).toEqual(extRes.signature.signature_type);
            expect(typeof result.signature.signature_bytes).toEqual(extRes.signature.signature_bytes);
            expect(result.sender).toBe(wallet.address);
        });

        it('should throw error if account does not exist', async() => {
            getMock.mockResolvedValueOnce({
                status: 400,
                data: {
                    error: "Account not found!"
                }
            })

            const wallet = Wallet.createRandom()

            await expect(
                txBuilder
                    .payload({foo: 'bar'})
                    .payloadType(PayloadType.DEPLOY_DATABASE)
                    .signer(wallet)
                    .build()
            ).rejects.toThrow();
        })

        it('should throw error if it cannot estimate cost', async () => {
            const wallet = Wallet.createRandom()

            const mockedAccount = {
                address: wallet.address,
                balance: "10000000000000000",
                nonce: 1
            }

            getMock.mockResolvedValueOnce({
                status: 200,
                data: {
                    account: mockedAccount
                }
            })
            
            postMock.mockResolvedValueOnce({
                status: 400,
                data: {
                    error: 'Cannot estimate cost'
                }
            });

            await expect(
                txBuilder
                    .payload({foo: 'bar'})
                    .payloadType(PayloadType.DEPLOY_DATABASE)
                    .signer(wallet)
                    .build()
            ).rejects.toThrow();
        })
    });
})