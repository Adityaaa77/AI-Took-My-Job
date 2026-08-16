import { ApiService } from './api';
import type { BlockchainRecord } from '../types';
import { MOCK_BLOCKCHAIN_RECORDS } from './mockData';

let localBlockchainRecords: BlockchainRecord[] = [...MOCK_BLOCKCHAIN_RECORDS];

export const blockchainService = {
  async getAllRecords(params?: { event_type?: string; actor?: string }) {
    let filtered = [...localBlockchainRecords];
    if (params?.event_type) {
      filtered = filtered.filter((r) => r.event_type === params.event_type);
    }
    if (params?.actor) {
      filtered = filtered.filter((r) => r.actor.toLowerCase().includes(params.actor!.toLowerCase()));
    }
    return ApiService.get<BlockchainRecord[]>('/blockchain/records', filtered);
  },

  async verifyTransaction(tx_hash: string) {
    const record = localBlockchainRecords.find((r) => r.tx_hash === tx_hash);
    if (record) {
      return {
        success: true,
        verified: true,
        record,
        verificationDetails: {
          blockNumber: record.block_number,
          smartContractAddress: '0x32a890b21fa7e810941ab1947e45ef97e81fa29',
          stateProofStatus: 'Cryptographically Validated',
          consensusNodes: 24,
          merkleRootValid: true,
        },
      };
    }
    return {
      success: false,
      verified: false,
      message: 'Transaction hash not recognized in local or network ledger.',
    };
  },

  async recordAuditEventOnChain(record: Omit<BlockchainRecord, 'tx_hash' | 'block_number' | 'timestamp' | 'gas_used' | 'is_verified'>) {
    const newRecord: BlockchainRecord = {
      ...record,
      tx_hash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      block_number: 19840500 + localBlockchainRecords.length,
      timestamp: new Date().toISOString(),
      gas_used: '92,400',
      is_verified: true,
    };
    localBlockchainRecords = [newRecord, ...localBlockchainRecords];
    return { success: true, data: newRecord };
  },
};
