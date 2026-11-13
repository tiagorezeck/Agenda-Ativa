/**
 * Cliente de Conexão com o Google Apps Script Web App (Motor DADOS DRIVE v2.0)
 * Todas as requisições passam pelo proxy reverso /api/drive-proxy (Anti-CORS / Anti-Iframe)
 */

import { GasApiPayload, GasBaseResponse } from '../types/api';
import {
  executeDriveRequest,
  getDriveConfig,
  isCloudActive,
  testDriveConnection
} from './driveSyncService';

export class GasApiClient {
  /**
   * Envia uma ação para o Google Apps Script Web App via /api/drive-proxy
   */
  public static async execute<T = any>(
    action: GasApiPayload['action'],
    payload?: any
  ): Promise<GasBaseResponse<T>> {
    const driveCfg = getDriveConfig();

    if (!isCloudActive()) {
      return {
        success: true,
        message: 'Executado via motor de dados local sincronizado.',
        data: undefined,
        timestamp: new Date().toISOString()
      };
    }

    try {
      const jsonResult = await executeDriveRequest<GasBaseResponse<T>>({
        targetUrl: driveCfg.webappUrl || undefined,
        action,
        data: payload,
        apiToken: driveCfg.apiToken
      });
      return {
        ...jsonResult,
        success: jsonResult.success ?? true,
        timestamp: jsonResult.timestamp || new Date().toISOString()
      };
    } catch (error: any) {
      console.warn('Falha na comunicação via /api/drive-proxy:', error);
      return {
        success: false,
        error: error.message || 'Erro ao conectar ao Motor DADOS DRIVE v2.0.',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Testa a conectividade (Ping v2.0) com o Web App fornecido
   */
  public static async testConnection(
    url?: string,
    token?: string
  ): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const res = await testDriveConnection(url, token);
      return {
        success: true,
        message:
          res.message ||
          `Conexão ativa com Agenda Ativa Motor v2.0 (${res.folder || 'Agenda Ativa/AppDatabase_Data'}).`,
        details: res
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Não foi possível conectar: ${err.message}`
      };
    }
  }
}
