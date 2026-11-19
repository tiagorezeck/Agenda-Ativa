// =========================================================================
// AGENDA ATIVA — MOTOR UNIVERSAL v2.1 UNIFICADO (DRIVE + SHEETS + SETUP + ENGSEG)
// Arquitetura Híbrida: Google Drive (JSON Mestre) + Sheets (Batch) + GAS
// =========================================================================
//
// INSTRUÇÕES DE IMPLANTAÇÃO (CÓDIGO ÚNICO):
// 1. Acesse script.new (ou Extensões > Apps Script na sua planilha).
// 2. Cole TODO este código único em Code.gs (já inclui o instalador das 13 abas).
// 3. (Opcional) Execute 'testConnection' ou 'inicializarPlanilha' para autorizar/criar abas.
// 4. Clique em Implantar > Nova Implantação > Tipo: App da Web.
// 5. Executar como: "Eu" | Quem tem acesso: "Qualquer pessoa".
// 6. Copie a URL /exec e cole em Configurações > Motor DADOS DRIVE.
// =========================================================================

// Função de teste para executar no editor e autorizar todas as permissões com 1 clique:
function testConnection() {
  var props = PropertiesService.getScriptProperties();
  props.getProperty("API_SECRET");
  var cache = CacheService.getScriptCache();
  cache.put("AGENDA_ATIVA_PING_TEST", "ok", 10);
  var folders = getAgendaAtivaFolders();
  var ss = getOrCreateSpreadsheet(folders.data);
  try { ScriptApp.getProjectTriggers(); } catch (eTrig) {}
  var pingOut = doGet({ parameter: { action: "ping" } });
  var pingText = pingOut && pingOut.getContent ? pingOut.getContent() : "";
  Logger.log("Conexão e permissões ativas! Planilha: " + ss.getName() + " (" + ss.getUrl() + ")");
  Logger.log("Resposta Ping: " + pingText);
  return "OK: Conexão autorizada com sucesso! Planilha: " + ss.getUrl();
}

// Instalador unificado (antigo SetupSheet.gs): cria e formata todas as 13 abas
function inicializarPlanilha() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    var folders = getAgendaAtivaFolders();
    ss = getOrCreateSpreadsheet(folders.data);
  }

  for (var sheetName in SHEETS_SCHEMA) {
    getOrCreateSheet(ss, sheetName, SHEETS_SCHEMA[sheetName]);
  }

  var configSheet = ss.getSheetByName("CONFIG");
  if (configSheet && configSheet.getLastRow() <= 1) {
    var now = new Date().toISOString();
    configSheet.appendRow(["EMPRESA_NOME", "Agenda Ativa", "Razão Social / Nome Fantasia", now]);
    configSheet.appendRow(["FUSO_HORARIO", "America/Sao_Paulo", "Fuso horário oficial", now]);
    configSheet.appendRow(["WHATSAPP_CONTATO", "", "WhatsApp de suporte", now]);
    configSheet.appendRow(["TERMOS_LGPD", "Seus dados serão utilizados exclusivamente para contato e realização do atendimento.", "Texto de consentimento LGPD", now]);
  }

  var userSheet = ss.getSheetByName("USUARIOS");
  if (userSheet && userSheet.getLastRow() <= 1) {
    var nowUsr = new Date().toISOString();
    userSheet.appendRow([
      "USR-001", "Administrador", "admin", "admin", "",
      "", "Administrador", "Administração", "", "ADMIN", "{}", true, nowUsr, nowUsr
    ]);
  }

  try {
    SpreadsheetApp.getUi().alert("Sucesso! As 13 abas do Agenda Ativa foram criadas e formatadas.");
  } catch (eUi) {}

  Logger.log("Planilha inicializada com as 13 abas: " + ss.getUrl());
  return "OK: As 13 abas foram criadas e formatadas em " + ss.getName() + " (" + ss.getUrl() + ")";
}

var ROOT_FOLDER_NAME = "Agenda Ativa";
var DATA_FOLDER_NAME = "AppDatabase_Data";
var BACKUP_FOLDER_NAME = "Backups";
var MEDIA_FOLDER_NAME = "Midia";
var SPREADSHEET_BASE_NAME = "AGENDA_ATIVA_DATABASE_SHEETS";
var ROOT_FILE_NAME = "database_root.json";

var CACHE_KEY_ROOT = "AGENDA_ATIVA_DATABASE_ROOT_V2";
var CACHE_CHUNK_SIZE = 80000; // Seguro abaixo do limite de 100KB do CacheService
var CACHE_TTL_SECONDS = 1800; // 30 minutos em memória
var MAX_LOGS_IN_ROOT = 500;

var SHEETS_SCHEMA = {
  CONFIG: ["chave", "valor", "descricao", "atualizado_em"],
  USUARIOS: [
    "id_usuario", "nome", "email", "senha", "foto_url", "telefone",
    "cargo", "departamento", "observacoes", "perfil", "permissoes", "ativo", "criado_em", "atualizado_em"
  ],
  EVENTOS: [
    "id_evento", "slug", "nome", "descricao", "imagem_url",
    "produto_nome", "produto_valor_mensal", "produto_parcelas", "produto_valor", "exibir_produto_publico",
    "solicitar_local", "label_local", "local_opcoes",
    "modo_datas", "recorrencia_ativa", "datas_especificas",
    "data_inicio", "data_fim", "dias_semana", "duracao_minutos",
    "intervalo_minutos", "capacidade_padrao", "responsavel_id",
    "status", "agenda_publica_ativa", "motivo_indisponivel", "mensagem_indisponivel", "permitir_lista_espera",
    "mensagem_confirmacao", "permite_cancelamento",
    "horas_antecedencia_cancelamento", "visitas", "criado_em", "atualizado_em"
  ],
  HORARIOS: ["id_horario", "id_evento", "hora_inicio", "hora_fim", "capacidade", "dias_aplicaveis", "ativo"],
  BLOQUEIOS: ["id_bloqueio", "id_evento", "data", "hora_inicio", "hora_fim", "motivo", "criado_por", "criado_em"],
  AGENDAMENTOS: [
    "id_agendamento", "protocolo", "id_evento", "id_lead",
    "data_agendamento", "hora_inicio", "hora_fim", "status",
    "motivo_cancelamento", "cancelado_em", "criado_em"
  ],
  LEADS: [
    "id_lead", "nome", "whatsapp", "email", "empresa", "cargo", "local", "status_cliente",
    "origem_primeiro_evento", "total_agendamentos", "data_ultimo_agendamento",
    "responsavel_id", "observacoes", "excluido", "excluido_em", "criado_em", "atualizado_em"
  ],
  CAMPOS_FORMULARIO: [
    "id_campo", "id_evento", "nome_campo", "label", "tipo",
    "obrigatorio", "placeholder", "opcoes", "ordem", "ativo"
  ],
  RESPOSTAS: ["id_resposta", "id_agendamento", "id_lead", "id_campo", "valor", "criado_em"],
  CRM: [
    "id_oportunidade", "id_lead", "id_agendamento_origem", "titulo", "produto_nome",
    "produto_valor_mensal", "produto_parcelas",
    "estagio", "sub_status", "valor_estimado", "valor_fechado", "responsavel_id",
    "data_proximo_followup", "motivo_perda", "data_fechamento",
    "ordem_coluna", "criado_em", "atualizado_em"
  ],
  HISTORICO_CRM: [
    "id_historico", "id_oportunidade", "tipo", "estagio_anterior",
    "estagio_novo", "descricao", "usuario_id", "criado_em"
  ],
  TAREFAS: [
    "id_tarefa", "id_oportunidade", "id_lead", "titulo", "descricao",
    "data_vencimento", "concluida", "responsavel_id", "criada_em", "concluida_em"
  ],
  LOGS: ["id_log", "nivel", "origem", "acao", "detalhes", "ip_ou_user_agent", "timestamp"]
};

// =========================================================================
// DO GET (CONSULTAS RÁPIDAS COM CACHE <100ms ANTES DE TOCAR NO DRIVE)
// =========================================================================
function buildPublicBookingPayload(dbObj) {
  var db = dbObj || {};
  var rawLeads = Array.isArray(db.leads) ? db.leads : [];
  var slimLeads = [];
  for (var i = 0; i < rawLeads.length; i++) {
    var l = rawLeads[i];
    if (!l || l.excluido === true) continue;
    slimLeads.push({
      id_lead: l.id_lead,
      nome: l.nome,
      whatsapp: l.whatsapp,
      email: l.email || ""
    });
  }
  return {
    config: Array.isArray(db.config) ? db.config : [],
    usuarios: [],
    eventos: Array.isArray(db.eventos) ? db.eventos : [],
    horarios: Array.isArray(db.horarios) ? db.horarios : [],
    bloqueios: Array.isArray(db.bloqueios) ? db.bloqueios : [],
    agendamentos: Array.isArray(db.agendamentos) ? db.agendamentos : [],
    leads: slimLeads,
    campos_formulario: Array.isArray(db.campos_formulario) ? db.campos_formulario : [],
    respostas: [],
    crm: [],
    historico_crm: [],
    tarefas: [],
    logs: []
  };
}

function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || "get";

    // 0. Validação de Token de Segurança (API_SECRET)
    var auth = validateSecurityToken(e, null);
    if (!auth.valid) {
      return jsonResponse({ status: "unauthorized", statusCode: 401, message: auth.error }, 401);
    }

    // 0B. VIA EXPRESSA DE CACHE EM MEMÓRIA (<100ms — SEM CHAMAR DRIVEAPP)
    var isFastReadAction =
      action === "get" ||
      action === "GET_DATABASE" ||
      action === "GET_PUBLIC_BOOKING" ||
      action === "GET_EVENT_BY_SLUG";

    if (isFastReadAction && !params.nocache) {
      var cachedRoot = getFromCache(CACHE_KEY_ROOT);
      if (cachedRoot) {
        if (action === "GET_PUBLIC_BOOKING") {
          return jsonResponse({ status: "success", data: buildPublicBookingPayload(JSON.parse(cachedRoot)), cached: true });
        }
        if (action === "GET_EVENT_BY_SLUG") {
          var parsedFast = JSON.parse(cachedRoot);
          var evListFast = Array.isArray(parsedFast.eventos) ? parsedFast.eventos : [];
          var slugFast = String(params.slug || "").trim();
          var evFoundFast = null;
          for (var fi = 0; fi < evListFast.length; fi++) {
            if (evListFast[fi].slug === slugFast || evListFast[fi].id_evento === slugFast) {
              evFoundFast = evListFast[fi];
              break;
            }
          }
          if (!evFoundFast) {
            return jsonResponse({ status: "error", statusCode: 404, message: "Evento não encontrado." }, 404);
          }
          return jsonResponse({ status: "success", data: evFoundFast, cached: true });
        }
        if (action === "GET_DATABASE") {
          return jsonResponse({ status: "success", data: JSON.parse(cachedRoot), cached: true });
        }
        return ContentService.createTextOutput(cachedRoot).setMimeType(ContentService.MimeType.JSON);
      }
    }

    var folder = getDataFolderFast();

    // 1. PING / TESTE DE CONEXÃO
    if (action === "ping" || action === "test") {
      var ss = getOrCreateSpreadsheet(folder);
      setupDailyBackupTrigger();

      var exportUrl = "https://docs.google.com/spreadsheets/d/" + ss.getId() + "/export?format=xlsx";
      var scriptSecret = PropertiesService.getScriptProperties().getProperty("API_SECRET") || "";
      var hasDatabase = Boolean(getRootJsonFileFast(folder));

      return jsonResponse({
        status: "success",
        statusCode: 200,
        systemName: "Agenda Ativa",
        hasDatabase: hasDatabase,
        securedWithToken: Boolean(scriptSecret),
        rootFolder: ROOT_FOLDER_NAME,
        folder: ROOT_FOLDER_NAME + "/" + DATA_FOLDER_NAME,
        spreadsheetName: ss.getName(),
        spreadsheetUrl: ss.getUrl(),
        spreadsheetId: ss.getId(),
        exportXlsxUrl: exportUrl,
        cacheEnabled: true,
        lockEnabled: true,
        engsegEnabled: true,
        version: "2.1-Fast",
        timestamp: new Date().getTime(),
        message: "Conexão ativa! Agenda Ativa Motor v2.1 pronto (" + ss.getName() + ")."
      });
    }

    // 2. LISTAR ARQUIVOS E CHECKPOINTS
    if (action === "list_files") {
      var files = folder.getFiles();
      var list = [];
      while (files.hasNext()) {
        var file = files.next();
        var fileName = file.getName();
        list.push({
          id: file.getId(),
          name: fileName,
          isRoot: fileName === ROOT_FILE_NAME,
          size: file.getSize(),
          lastUpdated: file.getLastUpdated().getTime(),
          url: file.getUrl()
        });
      }
      list.sort(function(a, b) { return b.lastUpdated - a.lastUpdated; });
      return jsonResponse({ status: "success", files: list });
    }

    // 3. BUSCAR ARQUIVO ESPECÍFICO
    if (action === "get_file") {
      var targetFileName = params.fileName || ROOT_FILE_NAME;
      var targetFiles = folder.getFilesByName(targetFileName);
      if (targetFiles.hasNext()) {
        var tFile = targetFiles.next();
        return ContentService.createTextOutput(tFile.getBlob().getDataAsString("UTF-8"))
          .setMimeType(ContentService.MimeType.JSON);
      }
      return jsonResponse({ status: "error", statusCode: 404, message: "Arquivo não encontrado." }, 404);
    }

    // 4. BUSCAR EVENTO PÚBLICO POR SLUG (FALLBACK SEM CACHE)
    if (action === "GET_EVENT_BY_SLUG") {
      var dbCachedOrDisk = loadAuthoritativeDatabaseFast(folder, Boolean(params.nocache));
      var eventos = Array.isArray(dbCachedOrDisk.eventos) ? dbCachedOrDisk.eventos : [];
      var slug = String(params.slug || "").trim();
      var eventoEncontrado = null;
      for (var i = 0; i < eventos.length; i++) {
        if (eventos[i].slug === slug || eventos[i].id_evento === slug) {
          eventoEncontrado = eventos[i];
          break;
        }
      }
      if (!eventoEncontrado) {
        return jsonResponse({ status: "error", statusCode: 404, message: "Evento não encontrado." }, 404);
      }
      return jsonResponse({ status: "success", data: eventoEncontrado });
    }

    // 5. GET PADRÃO / GET_PUBLIC_BOOKING COM POPULAÇÃO DE CACHE
    var dbData = loadAuthoritativeDatabaseFast(folder, Boolean(params.nocache));
    var serializedData = JSON.stringify(dbData);
    putToCache(CACHE_KEY_ROOT, serializedData, CACHE_TTL_SECONDS);

    if (action === "GET_PUBLIC_BOOKING") {
      return jsonResponse({ status: "success", data: buildPublicBookingPayload(dbData), cached: false });
    }

    if (action === "GET_DATABASE") {
      return jsonResponse({ status: "success", data: dbData, cached: false });
    }

    return ContentService.createTextOutput(serializedData).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return jsonResponse({ status: "error", statusCode: 500, message: err.toString() }, 500);
  }
}

// =========================================================================
// DO POST (ESCRITA ATÔMICA COM LOCK SERVICE + BATCH WRITING + 2FA ENGSEG)
// =========================================================================
function doPost(e) {
  var postData = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
  var payload = {};
  try { payload = JSON.parse(postData); } catch (eParse) { payload = {}; }

  var auth = validateSecurityToken(e, payload);
  if (!auth.valid) {
    return jsonResponse({ status: "unauthorized", statusCode: 401, message: auth.error }, 401);
  }

  var action = payload.action || "save";

  // Ações 2FA ENGSEG (não dependem de lock de escrita no banco)
  if (action === "SEND_2FA_CODE") {
    return handleSend2FACode(payload.data || payload.payload || payload);
  }
  if (action === "VERIFY_2FA_CODE") {
    return handleVerify2FACode(payload.data || payload.payload || payload);
  }

  var lock = LockService.getScriptLock();
  var hasLock = false;
  try {
    hasLock = lock.tryLock(30000);
  } catch (eLock) {
    hasLock = false;
  }

  if (!hasLock) {
    return jsonResponse({
      status: "error",
      statusCode: 429,
      message: "Servidor ocupado processando operações simultâneas. Tente novamente em instantes."
    }, 429);
  }

  try {
    var folder = getDataFolderFast();
    var spreadsheet = getOrCreateSpreadsheet(folder);

    // 1. CONFIGURAR API_SECRET
    if (action === "SET_API_SECRET") {
      var newSecret = String((payload.data && payload.data.newSecret) || payload.newSecret || payload.secret || "").trim();
      if (newSecret) {
        PropertiesService.getScriptProperties().setProperty("API_SECRET", newSecret);
        return jsonResponse({ status: "success", message: "API Secret configurada com sucesso!" });
      } else {
        PropertiesService.getScriptProperties().deleteProperty("API_SECRET");
        return jsonResponse({ status: "success", message: "API Secret removida." });
      }
    }

    // 2. CRIAR CHECKPOINT MANUAL
    if (action === "create_checkpoint") {
      var now = new Date();
      var timestamp = formatDate(now);
      var checkpointName = "Checkpoint-" + timestamp + ".json";
      var cpSource = payload.data || loadAuthoritativeDatabaseFast(folder, false);
      var content = JSON.stringify(cpSource, null, 2);
      folder.createFile(checkpointName, content, MimeType.PLAIN_TEXT);
      return jsonResponse({ status: "success", fileName: checkpointName, message: "Checkpoint criado com sucesso." });
    }

    // 3. RESTAURAR CHECKPOINT COMO RAIZ
    if (action === "set_as_root") {
      var srcFileName = payload.fileName;
      var srcFiles = folder.getFilesByName(srcFileName);
      if (!srcFiles.hasNext()) {
        return jsonResponse({ status: "error", statusCode: 404, message: "Checkpoint não encontrado." }, 404);
      }
      var srcContent = srcFiles.next().getBlob().getDataAsString("UTF-8");
      var parsedContent = JSON.parse(srcContent);
      var compactRestored = JSON.stringify(parsedContent);

      upsertRootJsonFileFast(folder, compactRestored);
      syncDataToGoogleSheets(spreadsheet, parsedContent);
      putToCache(CACHE_KEY_ROOT, compactRestored, CACHE_TTL_SECONDS);

      return jsonResponse({ status: "success", data: parsedContent, content: parsedContent, message: "Checkpoint restaurado como banco principal." });
    }

    // 4. OPERAÇÃO ATÔMICA DE AGENDAMENTO PÚBLICO (ANTI-OVERBOOKING SOB LOCK + GRAVAÇÃO INCREMENTAL RÁPIDA)
    if (action === "CREATE_BOOKING") {
      var currentDb = loadAuthoritativeDatabaseFast(folder, false);
      var bookingInput = payload.data || payload.payload || payload;
      var bookingOutcome = executeAtomicBookingOnDb(currentDb, bookingInput);
      if (!bookingOutcome.success) {
        return jsonResponse({ status: "error", statusCode: 409, message: bookingOutcome.error }, 409);
      }

      trimLogsInDb(currentDb);
      var serializedBookingDb = JSON.stringify(currentDb);
      upsertRootJsonFileFast(folder, serializedBookingDb);
      putToCache(CACHE_KEY_ROOT, serializedBookingDb, CACHE_TTL_SECONDS);
      syncBookingDeltaToSheets(spreadsheet, bookingOutcome.touched);
      setupDailyBackupTrigger();

      return jsonResponse({
        status: "success",
        data: bookingOutcome.data,
        spreadsheetUrl: spreadsheet.getUrl()
      });
    }

    // 4B. CANCELAMENTO ATÔMICO PELO CLIENTE OU ADMIN (SOB LOCK)
    if (action === "CANCEL_BOOKING") {
      var dbCancel = loadAuthoritativeDatabaseFast(folder, false);
      var cancelInput = payload.data || payload.payload || payload;
      var cancelOutcome = executeAtomicCancelOnDb(dbCancel, cancelInput);
      if (!cancelOutcome.success) {
        return jsonResponse({ status: "error", statusCode: 400, message: cancelOutcome.error }, 400);
      }

      trimLogsInDb(dbCancel);
      var serializedCancel = JSON.stringify(dbCancel);
      upsertRootJsonFileFast(folder, serializedCancel);
      putToCache(CACHE_KEY_ROOT, serializedCancel, CACHE_TTL_SECONDS);
      syncBookingStatusDeltaToSheets(spreadsheet, dbCancel);

      return jsonResponse({
        status: "success",
        data: cancelOutcome.data,
        database: dbCancel
      });
    }

    // 4C. REMARCAÇÃO ATÔMICA PELO CLIENTE (SOB LOCK)
    if (action === "RESCHEDULE_BOOKING") {
      var dbResched = loadAuthoritativeDatabaseFast(folder, false);
      var reschedInput = payload.data || payload.payload || payload;
      var reschedOutcome = executeAtomicRescheduleOnDb(dbResched, reschedInput);
      if (!reschedOutcome.success) {
        return jsonResponse({ status: "error", statusCode: 409, message: reschedOutcome.error }, 409);
      }

      trimLogsInDb(dbResched);
      var serializedResched = JSON.stringify(dbResched);
      upsertRootJsonFileFast(folder, serializedResched);
      putToCache(CACHE_KEY_ROOT, serializedResched, CACHE_TTL_SECONDS);
      syncBookingStatusDeltaToSheets(spreadsheet, dbResched);

      return jsonResponse({
        status: "success",
        data: reschedOutcome.data,
        database: dbResched
      });
    }

    // 4D. CONTABILIZAR VISITA NO LINK PÚBLICO DO EVENTO (SOB LOCK)
    if (action === "INCREMENT_EVENT_VISIT") {
      var dbVisit = loadAuthoritativeDatabaseFast(folder, false);
      var visitInput = payload.data || payload.payload || payload;
      var targetId = String(visitInput.id_evento || "").trim().toLowerCase();
      var targetSlug = String(visitInput.slug || "").trim().toLowerCase();
      var evListVisit = Array.isArray(dbVisit.eventos) ? dbVisit.eventos : [];
      var updatedEv = null;
      for (var vi = 0; vi < evListVisit.length; vi++) {
        var evItem = evListVisit[vi];
        if (!evItem) continue;
        var evIdNorm = String(evItem.id_evento || "").trim().toLowerCase();
        var evSlugNorm = String(evItem.slug || "").trim().toLowerCase();
        if ((targetId && evIdNorm === targetId) || (targetSlug && evSlugNorm === targetSlug)) {
          evItem.visitas = (Number(evItem.visitas) || 0) + 1;
          updatedEv = evItem;
          break;
        }
      }
      if (!updatedEv) {
        return jsonResponse({ status: "error", statusCode: 404, message: "Evento não encontrado para contabilizar visita." }, 404);
      }
      var serializedVisit = JSON.stringify(dbVisit);
      upsertRootJsonFileFast(folder, serializedVisit);
      putToCache(CACHE_KEY_ROOT, serializedVisit, CACHE_TTL_SECONDS);
      return jsonResponse({
        status: "success",
        id_evento: updatedEv.id_evento,
        visitas: updatedEv.visitas
      });
    }

    // 4E. CADASTRO EM LISTA DE ESPERA QUANDO EVENTO ESTÁ FECHADO / ESGOTADO (SOB LOCK)
    if (action === "REGISTER_WAITLIST") {
      var dbWait = loadAuthoritativeDatabaseFast(folder, false);
      var waitInput = payload.data || payload.payload || payload;
      var waitOutcome = executeAtomicWaitlistOnDb(dbWait, waitInput);
      if (!waitOutcome.success) {
        return jsonResponse({ status: "error", statusCode: 400, message: waitOutcome.error }, 400);
      }

      trimLogsInDb(dbWait);
      var serializedWaitDb = JSON.stringify(dbWait);
      upsertRootJsonFileFast(folder, serializedWaitDb);
      putToCache(CACHE_KEY_ROOT, serializedWaitDb, CACHE_TTL_SECONDS);
      syncBookingDeltaToSheets(spreadsheet, waitOutcome.touched);

      return jsonResponse({
        status: "success",
        waitlist: true,
        data: waitOutcome.data,
        database: dbWait
      });
    }

    // 5. SALVAR / SINCRONIZAR BANCO GERAL (save)
    var incomingData = payload.data || payload.payload || payload;
    var existingData = loadAuthoritativeDatabaseFast(folder, false);
    var mergedData = mergeDatabaseObjects(existingData, incomingData);
    ensureNativeUuids(mergedData);
    trimLogsInDb(mergedData);

    var serializedMerged = JSON.stringify(mergedData);
    upsertRootJsonFileFast(folder, serializedMerged);
    syncDataToGoogleSheets(spreadsheet, mergedData);
    putToCache(CACHE_KEY_ROOT, serializedMerged, CACHE_TTL_SECONDS);
    setupDailyBackupTrigger();

    return jsonResponse({
      status: "success",
      timestamp: new Date().getTime(),
      spreadsheetUrl: spreadsheet.getUrl(),
      spreadsheetName: spreadsheet.getName(),
      exportXlsxUrl: "https://docs.google.com/spreadsheets/d/" + spreadsheet.getId() + "/export?format=xlsx",
      data: mergedData
    });

  } catch (err) {
    return jsonResponse({ status: "error", statusCode: 500, message: err.toString() }, 500);
  } finally {
    if (hasLock) {
      try { lock.releaseLock(); } catch (e) {}
    }
  }
}

// =========================================================================
// MÓDULO ENGSEG — 2FA POR E-MAIL (OTP 6 DÍGITOS VIA CACHE + MAILAPP)
// =========================================================================
function handleSend2FACode(input) {
  try {
    var email = String((input && input.email) || "").trim().toLowerCase();
    if (!email || email.indexOf("@") === -1) {
      return jsonResponse({ status: "error", statusCode: 400, message: "Informe um e-mail válido para enviar o código ENGSEG." }, 400);
    }

    var code = String(Math.floor(100000 + Math.random() * 900000));
    var cacheKey = "ENGSEG_2FA_" + email;
    var otpPayload = JSON.stringify({
      code: code,
      email: email,
      attempts: 0,
      createdAt: new Date().getTime()
    });

    CacheService.getScriptCache().put(cacheKey, otpPayload, 300); // Válido por 5 minutos

    var subject = "[Agenda Ativa · ENGSEG] Código de Verificação 2FA: " + code;
    var htmlBody =
      '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:16px;background:#ffffff;">' +
      '<h2 style="margin:0 0 8px;color:#ea580c;">Agenda Ativa — Segurança ENGSEG</h2>' +
      '<p style="color:#4b5563;font-size:14px;line-height:1.5;">Use o código de verificação abaixo para liberar o acesso ao painel administrativo:</p>' +
      '<div style="margin:20px 0;padding:16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;text-align:center;">' +
      '<span style="font-family:monospace;font-size:32px;font-weight:bold;letter-spacing:6px;color:#9a3412;">' + code + '</span>' +
      '</div>' +
      '<p style="color:#6b7280;font-size:12px;">Este código expira em 5 minutos. Se você não solicitou este acesso, ignore esta mensagem.</p>' +
      '</div>';

    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody,
      body: "Agenda Ativa (ENGSEG) — Seu código de verificação 2FA é: " + code + " (válido por 5 minutos)."
    });

    return jsonResponse({
      status: "success",
      message: "Código 2FA enviado para " + email + " com validade de 5 minutos.",
      expiresInSeconds: 300
    });
  } catch (err) {
    return jsonResponse({ status: "error", statusCode: 500, message: "Erro ao enviar e-mail 2FA: " + err.toString() }, 500);
  }
}

function handleVerify2FACode(input) {
  try {
    var email = String((input && input.email) || "").trim().toLowerCase();
    var code = String((input && input.code) || "").trim();
    if (!email || !code) {
      return jsonResponse({ status: "error", statusCode: 400, message: "E-mail e código são obrigatórios." }, 400);
    }

    var cacheKey = "ENGSEG_2FA_" + email;
    var raw = CacheService.getScriptCache().get(cacheKey);
    if (!raw) {
      return jsonResponse({ status: "error", statusCode: 401, message: "Código expirado ou inexistente. Solicite um novo código." }, 401);
    }

    var otp = JSON.parse(raw);
    if (otp.attempts >= 5) {
      CacheService.getScriptCache().remove(cacheKey);
      return jsonResponse({ status: "error", statusCode: 429, message: "Número máximo de tentativas excedido. Solicite um novo código." }, 429);
    }

    if (otp.code !== code) {
      otp.attempts = (otp.attempts || 0) + 1;
      CacheService.getScriptCache().put(cacheKey, JSON.stringify(otp), 300);
      return jsonResponse({ status: "error", statusCode: 401, message: "Código inválido. Verifique e tente novamente." }, 401);
    }

    CacheService.getScriptCache().remove(cacheKey);
    return jsonResponse({
      status: "success",
      verified: true,
      email: email,
      message: "Autenticação ENGSEG 2FA validada com sucesso."
    });
  } catch (err) {
    return jsonResponse({ status: "error", statusCode: 500, message: err.toString() }, 500);
  }
}

// =========================================================================
// AGENDAMENTO ATÔMICO NO DOCUMENTO MESTRE (ANTI-OVERBOOKING)
// =========================================================================
function executeAtomicBookingOnDb(db, bookingData) {
  db.eventos = Array.isArray(db.eventos) ? db.eventos : [];
  db.horarios = Array.isArray(db.horarios) ? db.horarios : [];
  db.bloqueios = Array.isArray(db.bloqueios) ? db.bloqueios : [];
  db.agendamentos = Array.isArray(db.agendamentos) ? db.agendamentos : [];
  db.leads = Array.isArray(db.leads) ? db.leads : [];
  db.respostas = Array.isArray(db.respostas) ? db.respostas : [];
  db.crm = Array.isArray(db.crm) ? db.crm : [];
  db.historico_crm = Array.isArray(db.historico_crm) ? db.historico_crm : [];
  db.logs = Array.isArray(db.logs) ? db.logs : [];

  var evento = null;
  for (var i = 0; i < db.eventos.length; i++) {
    if (db.eventos[i].slug === bookingData.slug_evento || db.eventos[i].id_evento === bookingData.id_evento) {
      evento = db.eventos[i];
      break;
    }
  }

  if (!evento) return { success: false, error: "Evento não localizado." };
  if (evento.status !== "PUBLICADO" || evento.agenda_publica_ativa === false) {
    return { success: false, error: evento.mensagem_indisponivel || "Este evento não está aberto para agendamentos." };
  }

  var capacidadeSlot = Number(evento.capacidade_padrao) || 1;
  for (var h = 0; h < db.horarios.length; h++) {
    var slot = db.horarios[h];
    if (slot.id_evento === evento.id_evento && slot.hora_inicio === bookingData.hora_inicio && slot.ativo !== false) {
      capacidadeSlot = Number(slot.capacidade) || capacidadeSlot;
      break;
    }
  }

  for (var b = 0; b < db.bloqueios.length; b++) {
    var blk = db.bloqueios[b];
    if ((blk.id_evento === "*" || blk.id_evento === evento.id_evento) && blk.data === bookingData.data) {
      if (blk.hora_inicio === "ALL_DAY" || blk.hora_inicio === bookingData.hora_inicio) {
        return { success: false, error: "Este horário foi bloqueado administrativamente: " + (blk.motivo || "Indisponível") };
      }
    }
  }

  var confirmados = 0;
  for (var a = 0; a < db.agendamentos.length; a++) {
    var agd = db.agendamentos[a];
    if (agd.id_evento === evento.id_evento &&
        agd.data_agendamento === bookingData.data &&
        agd.hora_inicio === bookingData.hora_inicio &&
        agd.status === "CONFIRMADO") {
      confirmados++;
    }
  }

  if (confirmados >= capacidadeSlot) {
    db.logs.unshift({
      id_log: "LOG-" + Utilities.getUuid().slice(0, 8),
      nivel: "WARN",
      origem: "PUBLIC_BOOKING",
      acao: "OVERBOOKING_PREVENTED",
      detalhes: "Reserva bloqueada por lotação em " + bookingData.data + " às " + bookingData.hora_inicio,
      ip_ou_user_agent: "",
      timestamp: new Date().toISOString()
    });
    return { success: false, error: "Vagas esgotadas para este horário (" + confirmados + "/" + capacidadeSlot + "). Selecione outro horário." };
  }

  var nowIso = new Date().toISOString();
  var whatsappNorm = String(bookingData.whatsapp || "").replace(/\D/g, "");
  var emailNorm = String(bookingData.email || "").trim().toLowerCase();
  var localNorm = String(bookingData.local || "").trim();

  var leadEncontrado = null;
  for (var l = 0; l < db.leads.length; l++) {
    var lObj = db.leads[l];
    if (lObj.excluido === true) continue;
    var lZap = String(lObj.whatsapp || "").replace(/\D/g, "");
    var lEmail = String(lObj.email || "").trim().toLowerCase();
    if ((whatsappNorm && lZap === whatsappNorm) || (emailNorm && lEmail === emailNorm)) {
      leadEncontrado = lObj;
      break;
    }
  }

  var isNewLead = false;
  var leadRef = null;
  var idLead = "";
  if (leadEncontrado) {
    idLead = leadEncontrado.id_lead;
    leadEncontrado.nome = bookingData.nome || leadEncontrado.nome;
    if (bookingData.empresa) leadEncontrado.empresa = bookingData.empresa;
    if (localNorm) leadEncontrado.local = localNorm;
    leadEncontrado.total_agendamentos = (Number(leadEncontrado.total_agendamentos) || 0) + 1;
    leadEncontrado.data_ultimo_agendamento = nowIso;
    leadEncontrado.atualizado_em = nowIso;
    leadRef = leadEncontrado;
  } else {
    isNewLead = true;
    idLead = "LED-" + Utilities.getUuid().slice(0, 8).toUpperCase();
    leadRef = {
      id_lead: idLead,
      nome: bookingData.nome,
      whatsapp: whatsappNorm,
      email: emailNorm,
      empresa: bookingData.empresa || "",
      cargo: "",
      local: localNorm,
      status_cliente: "LEAD",
      origem_primeiro_evento: evento.id_evento,
      total_agendamentos: 1,
      data_ultimo_agendamento: nowIso,
      responsavel_id: evento.responsavel_id || "USR-001",
      observacoes: "Lead captado automaticamente pelo evento " + evento.nome,
      criado_em: nowIso,
      atualizado_em: nowIso
    };
    db.leads.unshift(leadRef);
  }

  var dataFmt = String(bookingData.data || "").replace(/-/g, "");
  var rand4 = Utilities.getUuid().slice(0, 4).toUpperCase();
  var protocolo = "PROT-" + dataFmt + "-" + rand4;
  var idAgendamento = "AGD-" + dataFmt + "-" + Utilities.getUuid().slice(0, 6).toUpperCase();

  var newAgendamento = {
    id_agendamento: idAgendamento,
    protocolo: protocolo,
    id_evento: evento.id_evento,
    id_lead: idLead,
    data_agendamento: bookingData.data,
    hora_inicio: bookingData.hora_inicio,
    hora_fim: bookingData.hora_fim || bookingData.hora_inicio,
    status: "CONFIRMADO",
    motivo_cancelamento: "",
    cancelado_em: "",
    criado_em: nowIso
  };
  db.agendamentos.unshift(newAgendamento);

  var newRespostas = [];
  if (bookingData.respostas_customizadas) {
    for (var campoId in bookingData.respostas_customizadas) {
      var val = bookingData.respostas_customizadas[campoId];
      if (val !== undefined && val !== null && val !== "") {
        var rspObj = {
          id_resposta: "RSP-" + Utilities.getUuid().slice(0, 8).toUpperCase(),
          id_agendamento: idAgendamento,
          id_lead: idLead,
          id_campo: campoId,
          valor: String(val),
          criado_em: nowIso
        };
        db.respostas.push(rspObj);
        newRespostas.push(rspObj);
      }
    }
  }

  var idOportunidade = "CRM-" + Utilities.getUuid().slice(0, 8).toUpperCase();
  var valorMensal = Number(evento.produto_valor_mensal) || 0;
  var parcelas = Math.max(1, Number(evento.produto_parcelas) || 1);
  var valorProduto = Number(evento.produto_valor) || (valorMensal > 0 ? valorMensal * parcelas : 0);
  var nomeProduto = String(evento.produto_nome || "").trim();
  var newCrm = {
    id_oportunidade: idOportunidade,
    id_lead: idLead,
    id_agendamento_origem: idAgendamento,
    titulo: bookingData.nome,
    produto_nome: nomeProduto,
    produto_valor_mensal: valorMensal > 0 ? valorMensal : 0,
    produto_parcelas: valorMensal > 0 ? parcelas : 1,
    estagio: "ENTRADA",
    sub_status: "FOLLOW",
    valor_estimado: valorProduto,
    valor_fechado: 0,
    responsavel_id: evento.responsavel_id || "USR-001",
    data_proximo_followup: bookingData.data,
    motivo_perda: "",
    data_fechamento: "",
    ordem_coluna: 1,
    criado_em: nowIso,
    atualizado_em: nowIso
  };
  db.crm.unshift(newCrm);

  var parcelaInfoTxt = (valorMensal > 0 && parcelas > 1)
    ? parcelas + "x de R$ " + valorMensal.toFixed(2) + " = "
    : "";
  var newHist = {
    id_historico: "HCRM-" + Utilities.getUuid().slice(0, 8).toUpperCase(),
    id_oportunidade: idOportunidade,
    tipo: "MUDANCA_ESTAGIO",
    estagio_anterior: "",
    estagio_novo: "ENTRADA",
    descricao: "Oportunidade gerada automaticamente a partir do agendamento " + protocolo +
      (nomeProduto || valorProduto > 0 ? " · Produto: " + (nomeProduto || evento.nome) + " (" + parcelaInfoTxt + "R$ " + valorProduto.toFixed(2) + ")" : ""),
    usuario_id: "SISTEMA",
    criado_em: nowIso
  };
  db.historico_crm.unshift(newHist);

  var newLog = {
    id_log: "LOG-" + Utilities.getUuid().slice(0, 8).toUpperCase(),
    nivel: "INFO",
    origem: "GAS_V2",
    acao: "BOOKING_CONFIRMED",
    detalhes: "Agendamento " + protocolo + " gravado com LockService.",
    ip_ou_user_agent: "",
    timestamp: nowIso
  };
  db.logs.unshift(newLog);

  return {
    success: true,
    data: {
      protocolo: protocolo,
      id_agendamento: idAgendamento,
      id_lead: idLead,
      id_oportunidade_crm: idOportunidade,
      evento_nome: evento.nome,
      data: bookingData.data,
      hora_inicio: bookingData.hora_inicio,
      hora_fim: bookingData.hora_fim || bookingData.hora_inicio,
      mensagem_confirmacao: evento.mensagem_confirmacao || "Seu agendamento foi confirmado com sucesso!"
    },
    touched: {
      lead: leadRef,
      isNewLead: isNewLead,
      agendamento: newAgendamento,
      respostas: newRespostas,
      crm: newCrm,
      historico: newHist,
      log: newLog
    }
  };
}

function executeAtomicCancelOnDb(db, input) {
  db.agendamentos = Array.isArray(db.agendamentos) ? db.agendamentos : [];
  db.eventos = Array.isArray(db.eventos) ? db.eventos : [];
  db.leads = Array.isArray(db.leads) ? db.leads : [];
  db.crm = Array.isArray(db.crm) ? db.crm : [];
  db.historico_crm = Array.isArray(db.historico_crm) ? db.historico_crm : [];
  db.logs = Array.isArray(db.logs) ? db.logs : [];

  var protocolo = String(input.protocolo || "").trim().toUpperCase();
  var contato = String(input.contato || "").trim().toLowerCase();
  var contatoDigits = contato.replace(/\D/g, "");
  var motivo = String(input.motivo || "Cancelado pelo cliente").trim();

  var agd = null;
  for (var i = 0; i < db.agendamentos.length; i++) {
    if (String(db.agendamentos[i].protocolo || "").toUpperCase() === protocolo) {
      agd = db.agendamentos[i];
      break;
    }
  }
  if (!agd) return { success: false, error: "Protocolo não encontrado." };
  if (agd.status === "CANCELADO") return { success: false, error: "Este agendamento já está cancelado." };

  var lead = null;
  for (var l = 0; l < db.leads.length; l++) {
    if (db.leads[l].id_lead === agd.id_lead) {
      lead = db.leads[l];
      break;
    }
  }

  if (contato) {
    var lZap = String((lead && lead.whatsapp) || "").replace(/\D/g, "");
    var lEmail = String((lead && lead.email) || "").trim().toLowerCase();
    var matchZap = contatoDigits && lZap && (lZap === contatoDigits || lZap.slice(-8) === contatoDigits.slice(-8));
    var matchEmail = lEmail && lEmail === contato;
    if (!matchZap && !matchEmail) {
      return { success: false, error: "WhatsApp ou e-mail não confere com o cadastro deste protocolo." };
    }
  }

  var evento = null;
  for (var e = 0; e < db.eventos.length; e++) {
    if (db.eventos[e].id_evento === agd.id_evento) {
      evento = db.eventos[e];
      break;
    }
  }

  if (evento && evento.permite_cancelamento === false) {
    return { success: false, error: "Este evento não permite cancelamento online." };
  }

  var nowIso = new Date().toISOString();
  agd.status = "CANCELADO";
  agd.motivo_cancelamento = motivo;
  agd.cancelado_em = nowIso;

  for (var c = 0; c < db.crm.length; c++) {
    if (db.crm[c].id_agendamento_origem === agd.id_agendamento) {
      var prev = db.crm[c].estagio;
      db.crm[c].estagio = "CANCELADO";
      db.crm[c].atualizado_em = nowIso;
      db.historico_crm.unshift({
        id_historico: "HCRM-" + Utilities.getUuid().slice(0, 8).toUpperCase(),
        id_oportunidade: db.crm[c].id_oportunidade,
        tipo: "MUDANCA_ESTAGIO",
        estagio_anterior: prev,
        estagio_novo: "CANCELADO",
        descricao: "Agendamento " + protocolo + " cancelado: " + motivo,
        usuario_id: "CLIENTE",
        criado_em: nowIso
      });
    }
  }

  db.logs.unshift({
    id_log: "LOG-" + Utilities.getUuid().slice(0, 8).toUpperCase(),
    nivel: "INFO",
    origem: "GAS_V2",
    acao: "BOOKING_CANCELLED",
    detalhes: "Protocolo " + protocolo + " cancelado. Vaga liberada.",
    ip_ou_user_agent: "",
    timestamp: nowIso
  });

  return { success: true, data: agd };
}

function executeAtomicRescheduleOnDb(db, input) {
  db.agendamentos = Array.isArray(db.agendamentos) ? db.agendamentos : [];
  db.eventos = Array.isArray(db.eventos) ? db.eventos : [];
  db.horarios = Array.isArray(db.horarios) ? db.horarios : [];
  db.bloqueios = Array.isArray(db.bloqueios) ? db.bloqueios : [];
  db.leads = Array.isArray(db.leads) ? db.leads : [];
  db.logs = Array.isArray(db.logs) ? db.logs : [];

  var protocolo = String(input.protocolo || "").trim().toUpperCase();
  var contato = String(input.contato || "").trim().toLowerCase();
  var contatoDigits = contato.replace(/\D/g, "");
  var novaData = String(input.nova_data || "").trim();
  var novaHoraInicio = String(input.nova_hora_inicio || "").trim();
  var novaHoraFim = String(input.nova_hora_fim || novaHoraInicio).trim();

  if (!novaData || !novaHoraInicio) {
    return { success: false, error: "Informe a nova data e horário desejados." };
  }

  var agd = null;
  for (var i = 0; i < db.agendamentos.length; i++) {
    if (String(db.agendamentos[i].protocolo || "").toUpperCase() === protocolo) {
      agd = db.agendamentos[i];
      break;
    }
  }
  if (!agd) return { success: false, error: "Protocolo não encontrado." };
  if (agd.status === "CANCELADO") return { success: false, error: "Agendamento já cancelado. Crie um novo agendamento." };

  var lead = null;
  for (var l = 0; l < db.leads.length; l++) {
    if (db.leads[l].id_lead === agd.id_lead) {
      lead = db.leads[l];
      break;
    }
  }

  if (contato) {
    var lZap = String((lead && lead.whatsapp) || "").replace(/\D/g, "");
    var lEmail = String((lead && lead.email) || "").trim().toLowerCase();
    var matchZap = contatoDigits && lZap && (lZap === contatoDigits || lZap.slice(-8) === contatoDigits.slice(-8));
    var matchEmail = lEmail && lEmail === contato;
    if (!matchZap && !matchEmail) {
      return { success: false, error: "WhatsApp ou e-mail não confere com o cadastro deste protocolo." };
    }
  }

  var evento = null;
  for (var e = 0; e < db.eventos.length; e++) {
    if (db.eventos[e].id_evento === agd.id_evento) {
      evento = db.eventos[e];
      break;
    }
  }
  if (!evento) return { success: false, error: "Evento não encontrado." };
  if (evento.permite_cancelamento === false) {
    return { success: false, error: "Este evento não permite remarcação online." };
  }

  for (var b = 0; b < db.bloqueios.length; b++) {
    var blk = db.bloqueios[b];
    if ((blk.id_evento === "*" || blk.id_evento === evento.id_evento) && blk.data === novaData) {
      if (blk.hora_inicio === "ALL_DAY" || blk.hora_inicio === novaHoraInicio) {
        return { success: false, error: "O novo horário selecionado está bloqueado." };
      }
    }
  }

  var capacidadeSlot = Number(evento.capacidade_padrao) || 1;
  for (var h = 0; h < db.horarios.length; h++) {
    var slot = db.horarios[h];
    if (slot.id_evento === evento.id_evento && slot.hora_inicio === novaHoraInicio && slot.ativo !== false) {
      capacidadeSlot = Number(slot.capacidade) || capacidadeSlot;
      break;
    }
  }

  var confirmados = 0;
  for (var a = 0; a < db.agendamentos.length; a++) {
    var item = db.agendamentos[a];
    if (item.id_agendamento !== agd.id_agendamento &&
        item.id_evento === evento.id_evento &&
        item.data_agendamento === novaData &&
        item.hora_inicio === novaHoraInicio &&
        item.status === "CONFIRMADO") {
      confirmados++;
    }
  }

  if (confirmados >= capacidadeSlot) {
    return { success: false, error: "Vagas esgotadas para o novo horário escolhido." };
  }

  var oldInfo = agd.data_agendamento + " " + agd.hora_inicio;
  agd.data_agendamento = novaData;
  agd.hora_inicio = novaHoraInicio;
  agd.hora_fim = novaHoraFim;
  agd.status = "CONFIRMADO";

  db.logs.unshift({
    id_log: "LOG-" + Utilities.getUuid().slice(0, 8).toUpperCase(),
    nivel: "INFO",
    origem: "GAS_V2",
    acao: "BOOKING_RESCHEDULED",
    detalhes: "Protocolo " + protocolo + " remarcado de " + oldInfo + " para " + novaData + " " + novaHoraInicio,
    ip_ou_user_agent: "",
    timestamp: new Date().toISOString()
  });

  return { success: true, data: agd };
}

function executeAtomicWaitlistOnDb(db, waitInput) {
  db.eventos = Array.isArray(db.eventos) ? db.eventos : [];
  db.leads = Array.isArray(db.leads) ? db.leads : [];
  db.crm = Array.isArray(db.crm) ? db.crm : [];
  db.historico_crm = Array.isArray(db.historico_crm) ? db.historico_crm : [];
  db.logs = Array.isArray(db.logs) ? db.logs : [];
  db.notificacoes = Array.isArray(db.notificacoes) ? db.notificacoes : [];

  var slug = String(waitInput.slug_evento || "").trim();
  var evento = null;
  for (var i = 0; i < db.eventos.length; i++) {
    if (db.eventos[i].slug === slug || db.eventos[i].id_evento === slug) {
      evento = db.eventos[i];
      break;
    }
  }
  if (!evento) {
    return { success: false, error: "Evento não encontrado para cadastro na lista de espera." };
  }

  var nome = String(waitInput.nome || "").trim();
  var whatsappNorm = String(waitInput.whatsapp || "").replace(/\D/g, "");
  var emailNorm = String(waitInput.email || "").trim().toLowerCase();
  var localNorm = String(waitInput.local || "").trim();
  var alunoNorm = String(waitInput.aluno_ganhador || "").trim();
  var motivoTxt = String(waitInput.motivo || "Agenda fechada / sem vagas").trim();
  var obsExtra = String(waitInput.observacoes || "").trim();

  if (!nome || !whatsappNorm) {
    return { success: false, error: "Nome completo e WhatsApp são obrigatórios." };
  }

  var nowIso = new Date().toISOString();
  var obsNota = "[Lista de Espera - " + evento.nome + " (" + motivoTxt + ")]" + (obsExtra ? " " + obsExtra : "");

  var lead = null;
  for (var l = 0; l < db.leads.length; l++) {
    var existing = db.leads[l];
    if (!existing || existing.excluido === true) continue;
    var existingZap = String(existing.whatsapp || "").replace(/\D/g, "");
    var existingEmail = String(existing.email || "").trim().toLowerCase();
    if ((whatsappNorm && existingZap === whatsappNorm) || (emailNorm && existingEmail === emailNorm)) {
      lead = existing;
      break;
    }
  }

  var idLead = "";
  if (lead) {
    idLead = lead.id_lead;
    lead.nome = nome || lead.nome;
    if (localNorm) lead.local = localNorm;
    if (alunoNorm) lead.aluno_ganhador = alunoNorm;
    lead.observacoes = lead.observacoes ? (lead.observacoes + " | " + obsNota) : obsNota;
    lead.atualizado_em = nowIso;
  } else {
    idLead = "LED-" + Utilities.getUuid().slice(0, 8).toUpperCase();
    lead = {
      id_lead: idLead,
      nome: nome,
      whatsapp: whatsappNorm,
      email: emailNorm,
      empresa: "",
      cargo: "",
      local: localNorm,
      aluno_ganhador: alunoNorm,
      status_cliente: "LEAD",
      origem_primeiro_evento: evento.id_evento,
      total_agendamentos: 0,
      data_ultimo_agendamento: "",
      responsavel_id: evento.responsavel_id || "USR-001",
      observacoes: obsNota,
      excluido: false,
      criado_em: nowIso,
      atualizado_em: nowIso
    };
    db.leads.unshift(lead);
  }

  var idOp = "CRM-" + Utilities.getUuid().slice(0, 8).toUpperCase();
  var valorEst = Number(evento.produto_valor) || 0;
  var newCrm = {
    id_oportunidade: idOp,
    id_lead: idLead,
    titulo: nome,
    produto_nome: evento.produto_nome || evento.nome,
    produto_valor_mensal: Number(evento.produto_valor_mensal) || 0,
    produto_parcelas: Number(evento.produto_parcelas) || 1,
    estagio: "FOLLOW_UP_STAND_BY",
    sub_status: "FOLLOW",
    valor_estimado: valorEst,
    valor_fechado: 0,
    responsavel_id: evento.responsavel_id || "USR-001",
    data_proximo_followup: nowIso.slice(0, 10),
    motivo_perda: "",
    data_fechamento: "",
    ordem_coluna: 1,
    criado_em: nowIso,
    atualizado_em: nowIso
  };
  db.crm.unshift(newCrm);

  var newHist = {
    id_historico: "HCRM-" + Utilities.getUuid().slice(0, 8).toUpperCase(),
    id_oportunidade: idOp,
    tipo: "NOTA",
    estagio_anterior: "",
    estagio_novo: "FOLLOW_UP_STAND_BY",
    descricao: "Interessado cadastrado na Lista de Espera para \"" + evento.nome + "\" (" + motivoTxt + "). Entrar em contato quando a agenda abrir.",
    usuario_id: "SISTEMA",
    criado_em: nowIso
  };
  db.historico_crm.unshift(newHist);

  db.notificacoes.unshift({
    id_notificacao: "NTF-" + Utilities.getUuid().slice(0, 8).toUpperCase(),
    tipo: "LEAD",
    titulo: "Novo interessado na Lista de Espera",
    mensagem: nome + " pediu para ser avisado quando a agenda de \"" + evento.nome + "\" abrir.",
    lida: false,
    criado_em: nowIso
  });

  db.logs.unshift({
    id_log: "LOG-" + Utilities.getUuid().slice(0, 8).toUpperCase(),
    nivel: "INFO",
    origem: "GAS_V2_PUBLIC_WAITLIST",
    acao: "WAITLIST_REGISTERED",
    detalhes: nome + " entrou na lista de espera de " + evento.nome,
    ip_ou_user_agent: "",
    timestamp: nowIso
  });

  return {
    success: true,
    data: {
      id_lead: idLead,
      id_oportunidade_crm: idOp,
      evento_nome: evento.nome,
      mensagem: "Cadastro realizado! Nossa equipe entrará em contato assim que novas vagas ou a agenda deste evento reabrir."
    },
    touched: {
      lead: lead,
      agendamento: null,
      respostas: [],
      crm: newCrm,
      historico: newHist
    }
  };
}

// =========================================================================
// ESPELHAMENTO EM BLOCO DAS 13 ABAS NO SHEETS (BATCH PROCESSING)
// =========================================================================
function syncDataToGoogleSheets(ss, data) {
  if (!data || typeof data !== "object") return;

  mirrorArrayToSheet(ss, "CONFIG", SHEETS_SCHEMA.CONFIG, data.config, function(c) {
    return [c.chave || "", c.valor || "", c.descricao || "", c.atualizado_em || ""];
  });

  mirrorArrayToSheet(ss, "USUARIOS", SHEETS_SCHEMA.USUARIOS, data.usuarios, function(u) {
    return [
      u.id_usuario || Utilities.getUuid(), u.nome || "", u.email || "", u.senha || "",
      u.foto_url || "", u.telefone || "", u.cargo || "", u.departamento || "",
      u.observacoes || "", u.perfil || "AGENTE",
      u.permissoes ? JSON.stringify(u.permissoes) : "{}",
      u.ativo !== false, u.criado_em || "", u.atualizado_em || ""
    ];
  });

  mirrorArrayToSheet(ss, "EVENTOS", SHEETS_SCHEMA.EVENTOS, data.eventos, function(ev) {
    return [
      ev.id_evento || Utilities.getUuid(), ev.slug || "", ev.nome || "", ev.descricao || "", ev.imagem_url || "",
      ev.produto_nome || "", Number(ev.produto_valor_mensal) || 0, Number(ev.produto_parcelas) || 1,
      Number(ev.produto_valor) || 0, Boolean(ev.exibir_produto_publico),
      Boolean(ev.solicitar_local), ev.label_local || "", JSON.stringify(ev.local_opcoes || []),
      ev.modo_datas || (ev.recorrencia_ativa ? "RECORRENTE" : "PERIODO"),
      Boolean(ev.recorrencia_ativa), JSON.stringify(ev.datas_especificas || []),
      ev.data_inicio || "", ev.data_fim || "", JSON.stringify(ev.dias_semana || []),
      Number(ev.duracao_minutos) || 60, Number(ev.intervalo_minutos) || 0, Number(ev.capacidade_padrao) || 1,
      ev.responsavel_id || "", ev.status || "PUBLICADO",
      ev.agenda_publica_ativa !== false, ev.motivo_indisponivel || "", ev.mensagem_indisponivel || "",
      ev.permitir_lista_espera !== false,
      ev.mensagem_confirmacao || "",
      ev.permite_cancelamento !== false, Number(ev.horas_antecedencia_cancelamento) || 24,
      Number(ev.visitas) || 0, ev.criado_em || "", ev.atualizado_em || ""
    ];
  });

  mirrorArrayToSheet(ss, "HORARIOS", SHEETS_SCHEMA.HORARIOS, data.horarios, function(h) {
    return [
      h.id_horario || Utilities.getUuid(), h.id_evento || "", h.hora_inicio || "", h.hora_fim || "",
      Number(h.capacidade) || 1, JSON.stringify(h.dias_aplicaveis || []), h.ativo !== false
    ];
  });

  mirrorArrayToSheet(ss, "BLOQUEIOS", SHEETS_SCHEMA.BLOQUEIOS, data.bloqueios, function(b) {
    return [
      b.id_bloqueio || Utilities.getUuid(), b.id_evento || "*", b.data || "", b.hora_inicio || "",
      b.hora_fim || "", b.motivo || "", b.criado_por || "", b.criado_em || ""
    ];
  });

  mirrorArrayToSheet(ss, "AGENDAMENTOS", SHEETS_SCHEMA.AGENDAMENTOS, data.agendamentos, function(a) {
    return [
      a.id_agendamento || Utilities.getUuid(), a.protocolo || "", a.id_evento || "", a.id_lead || "",
      a.data_agendamento || "", a.hora_inicio || "", a.hora_fim || "", a.status || "CONFIRMADO",
      a.motivo_cancelamento || "", a.cancelado_em || "", a.criado_em || ""
    ];
  });

  mirrorArrayToSheet(ss, "LEADS", SHEETS_SCHEMA.LEADS, data.leads, function(l) {
    return [
      l.id_lead || Utilities.getUuid(), l.nome || "", l.whatsapp || "", l.email || "",
      l.empresa || "", l.cargo || "", l.local || "", l.status_cliente || "LEAD", l.origem_primeiro_evento || "",
      Number(l.total_agendamentos) || 0, l.data_ultimo_agendamento || "",
      l.responsavel_id || "", l.observacoes || "", Boolean(l.excluido), l.excluido_em || "",
      l.criado_em || "", l.atualizado_em || ""
    ];
  });

  mirrorArrayToSheet(ss, "CAMPOS_FORMULARIO", SHEETS_SCHEMA.CAMPOS_FORMULARIO, data.campos_formulario, function(f) {
    return [
      f.id_campo || Utilities.getUuid(), f.id_evento || "", f.nome_campo || "", f.label || "",
      f.tipo || "TEXTO_CURTO", Boolean(f.obrigatorio), f.placeholder || "",
      JSON.stringify(f.opcoes || []), Number(f.ordem) || 1, f.ativo !== false
    ];
  });

  mirrorArrayToSheet(ss, "RESPOSTAS", SHEETS_SCHEMA.RESPOSTAS, data.respostas, function(r) {
    return [
      r.id_resposta || Utilities.getUuid(), r.id_agendamento || "", r.id_lead || "",
      r.id_campo || "", r.valor || "", r.criado_em || ""
    ];
  });

  mirrorArrayToSheet(ss, "CRM", SHEETS_SCHEMA.CRM, data.crm, function(c) {
    return [
      c.id_oportunidade || Utilities.getUuid(), c.id_lead || "", c.id_agendamento_origem || "",
      c.titulo || "", c.produto_nome || "", Number(c.produto_valor_mensal) || 0, Number(c.produto_parcelas) || 1,
      c.estagio || "ENTRADA", c.sub_status || "FOLLOW",
      Number(c.valor_estimado) || 0, Number(c.valor_fechado) || 0, c.responsavel_id || "",
      c.data_proximo_followup || "", c.motivo_perda || "", c.data_fechamento || "",
      Number(c.ordem_coluna) || 1, c.criado_em || "", c.atualizado_em || ""
    ];
  });

  mirrorArrayToSheet(ss, "HISTORICO_CRM", SHEETS_SCHEMA.HISTORICO_CRM, data.historico_crm, function(hc) {
    return [
      hc.id_historico || Utilities.getUuid(), hc.id_oportunidade || "", hc.tipo || "NOTA",
      hc.estagio_anterior || "", hc.estagio_novo || "", hc.descricao || "",
      hc.usuario_id || "", hc.criado_em || ""
    ];
  });

  mirrorArrayToSheet(ss, "TAREFAS", SHEETS_SCHEMA.TAREFAS, data.tarefas, function(t) {
    return [
      t.id_tarefa || Utilities.getUuid(), t.id_oportunidade || "", t.id_lead || "",
      t.titulo || "", t.descricao || "", t.data_vencimento || "",
      Boolean(t.concluida), t.responsavel_id || "", t.criada_em || "", t.concluida_em || ""
    ];
  });

  mirrorArrayToSheet(ss, "LOGS", SHEETS_SCHEMA.LOGS, data.logs, function(lg) {
    return [
      lg.id_log || Utilities.getUuid(), lg.nivel || "INFO", lg.origem || "",
      lg.acao || "", lg.detalhes || "", lg.ip_ou_user_agent || "", lg.timestamp || ""
    ];
  });
}

function mirrorArrayToSheet(ss, sheetName, headers, list, mapperFn) {
  var sheet = getOrCreateSheet(ss, sheetName, headers);
  if (!Array.isArray(list)) return;
  var rows = list.map(mapperFn);
  writeRowsToSheet(sheet, rows, headers.length);
}

function writeRowsToSheet(sheet, rows, colCount) {
  var lastRow = sheet.getLastRow();
  var lastCol = Math.max(sheet.getLastColumn() || 1, colCount || 1);
  if (lastRow > 1 && lastCol > 0) {
    sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
  }
  if (rows && rows.length > 0 && rows[0] && rows[0].length > 0) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
}

function appendRowsToSheetFast(ss, sheetName, headers, rows) {
  if (!rows || rows.length === 0) return;
  var sheet = getOrCreateSheet(ss, sheetName, headers);
  var startRow = Math.max(2, sheet.getLastRow() + 1);
  sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
}

function upsertLeadRowFast(ss, leadRow) {
  var sheet = getOrCreateSheet(ss, "LEADS", SHEETS_SCHEMA.LEADS);
  var lastRow = sheet.getLastRow();
  var leadId = String(leadRow[0] || "");
  if (lastRow >= 2 && leadId) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0] || "") === leadId) {
        sheet.getRange(i + 2, 1, 1, leadRow.length).setValues([leadRow]);
        return;
      }
    }
  }
  sheet.getRange(Math.max(2, lastRow + 1), 1, 1, leadRow.length).setValues([leadRow]);
}

function syncBookingDeltaToSheets(ss, touched) {
  if (!touched) return;
  try {
    if (touched.agendamento) {
      var a = touched.agendamento;
      appendRowsToSheetFast(ss, "AGENDAMENTOS", SHEETS_SCHEMA.AGENDAMENTOS, [[
        a.id_agendamento || Utilities.getUuid(), a.protocolo || "", a.id_evento || "", a.id_lead || "",
        a.data_agendamento || "", a.hora_inicio || "", a.hora_fim || "", a.status || "CONFIRMADO",
        a.motivo_cancelamento || "", a.cancelado_em || "", a.criado_em || ""
      ]]);
    }

    if (touched.lead) {
      var l = touched.lead;
      var leadRow = [
        l.id_lead || Utilities.getUuid(), l.nome || "", l.whatsapp || "", l.email || "",
        l.empresa || "", l.cargo || "", l.local || "", l.status_cliente || "LEAD", l.origem_primeiro_evento || "",
        Number(l.total_agendamentos) || 0, l.data_ultimo_agendamento || "",
        l.responsavel_id || "", l.observacoes || "", Boolean(l.excluido), l.excluido_em || "",
        l.criado_em || "", l.atualizado_em || ""
      ];
      if (touched.isNewLead) {
        appendRowsToSheetFast(ss, "LEADS", SHEETS_SCHEMA.LEADS, [leadRow]);
      } else {
        upsertLeadRowFast(ss, leadRow);
      }
    }

    if (Array.isArray(touched.respostas) && touched.respostas.length > 0) {
      var rspRows = touched.respostas.map(function(r) {
        return [
          r.id_resposta || Utilities.getUuid(), r.id_agendamento || "", r.id_lead || "",
          r.id_campo || "", r.valor || "", r.criado_em || ""
        ];
      });
      appendRowsToSheetFast(ss, "RESPOSTAS", SHEETS_SCHEMA.RESPOSTAS, rspRows);
    }

    if (touched.crm) {
      var c = touched.crm;
      appendRowsToSheetFast(ss, "CRM", SHEETS_SCHEMA.CRM, [[
        c.id_oportunidade || Utilities.getUuid(), c.id_lead || "", c.id_agendamento_origem || "",
        c.titulo || "", c.produto_nome || "", Number(c.produto_valor_mensal) || 0, Number(c.produto_parcelas) || 1,
        c.estagio || "ENTRADA", c.sub_status || "FOLLOW",
        Number(c.valor_estimado) || 0, Number(c.valor_fechado) || 0, c.responsavel_id || "",
        c.data_proximo_followup || "", c.motivo_perda || "", c.data_fechamento || "",
        Number(c.ordem_coluna) || 1, c.criado_em || "", c.atualizado_em || ""
      ]]);
    }

    if (touched.historico) {
      var hc = touched.historico;
      appendRowsToSheetFast(ss, "HISTORICO_CRM", SHEETS_SCHEMA.HISTORICO_CRM, [[
        hc.id_historico || Utilities.getUuid(), hc.id_oportunidade || "", hc.tipo || "NOTA",
        hc.estagio_anterior || "", hc.estagio_novo || "", hc.descricao || "",
        hc.usuario_id || "", hc.criado_em || ""
      ]]);
    }

    if (touched.log) {
      var lg = touched.log;
      appendRowsToSheetFast(ss, "LOGS", SHEETS_SCHEMA.LOGS, [[
        lg.id_log || Utilities.getUuid(), lg.nivel || "INFO", lg.origem || "",
        lg.acao || "", lg.detalhes || "", lg.ip_ou_user_agent || "", lg.timestamp || ""
      ]]);
    }
  } catch (eDelta) {}
}

function syncBookingStatusDeltaToSheets(ss, data) {
  if (!data || typeof data !== "object") return;
  mirrorArrayToSheet(ss, "AGENDAMENTOS", SHEETS_SCHEMA.AGENDAMENTOS, data.agendamentos, function(a) {
    return [
      a.id_agendamento || Utilities.getUuid(), a.protocolo || "", a.id_evento || "", a.id_lead || "",
      a.data_agendamento || "", a.hora_inicio || "", a.hora_fim || "", a.status || "CONFIRMADO",
      a.motivo_cancelamento || "", a.cancelado_em || "", a.criado_em || ""
    ];
  });
  mirrorArrayToSheet(ss, "CRM", SHEETS_SCHEMA.CRM, data.crm, function(c) {
    return [
      c.id_oportunidade || Utilities.getUuid(), c.id_lead || "", c.id_agendamento_origem || "",
      c.titulo || "", c.produto_nome || "", Number(c.produto_valor_mensal) || 0, Number(c.produto_parcelas) || 1,
      c.estagio || "ENTRADA", c.sub_status || "FOLLOW",
      Number(c.valor_estimado) || 0, Number(c.valor_fechado) || 0, c.responsavel_id || "",
      c.data_proximo_followup || "", c.motivo_perda || "", c.data_fechamento || "",
      Number(c.ordem_coluna) || 1, c.criado_em || "", c.atualizado_em || ""
    ];
  });
  mirrorArrayToSheet(ss, "HISTORICO_CRM", SHEETS_SCHEMA.HISTORICO_CRM, data.historico_crm, function(hc) {
    return [
      hc.id_historico || Utilities.getUuid(), hc.id_oportunidade || "", hc.tipo || "NOTA",
      hc.estagio_anterior || "", hc.estagio_novo || "", hc.descricao || "",
      hc.usuario_id || "", hc.criado_em || ""
    ];
  });
  mirrorArrayToSheet(ss, "LOGS", SHEETS_SCHEMA.LOGS, data.logs, function(lg) {
    return [
      lg.id_log || Utilities.getUuid(), lg.nivel || "INFO", lg.origem || "",
      lg.acao || "", lg.detalhes || "", lg.ip_ou_user_agent || "", lg.timestamp || ""
    ];
  });
}

// =========================================================================
// HELPERS DRIVE JSON, CACHE CHUNKED, UUID, SEGURANÇA E BACKUP
// =========================================================================
function parseJsonCell(val, fallback) {
  if (val === undefined || val === null || val === "") return fallback;
  if (typeof val !== "string") return val;
  try { return JSON.parse(val); } catch (e) { return fallback; }
}

function readSheetObjects(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0];
  var list = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var hasAny = false;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      var key = String(headers[c] || "").trim();
      if (!key) continue;
      var cellVal = row[c];
      if (cellVal !== "" && cellVal !== null && cellVal !== undefined) hasAny = true;
      obj[key] = cellVal;
    }
    if (hasAny) list.push(obj);
  }
  return list;
}

function readDatabaseFromSheets(folder) {
  try {
    var files = folder.getFilesByName(SPREADSHEET_BASE_NAME);
    if (!files.hasNext()) return null;
    var ss = SpreadsheetApp.openById(files.next().getId());

    var eventosRaw = readSheetObjects(ss, "EVENTOS");
    var horariosRaw = readSheetObjects(ss, "HORARIOS");
    var configRaw = readSheetObjects(ss, "CONFIG");
    var usuariosRaw = readSheetObjects(ss, "USUARIOS");
    var bloqueiosRaw = readSheetObjects(ss, "BLOQUEIOS");
    var agendamentosRaw = readSheetObjects(ss, "AGENDAMENTOS");
    var leadsRaw = readSheetObjects(ss, "LEADS");
    var camposRaw = readSheetObjects(ss, "CAMPOS_FORMULARIO");
    var respostasRaw = readSheetObjects(ss, "RESPOSTAS");
    var crmRaw = readSheetObjects(ss, "CRM");
    var histCrmRaw = readSheetObjects(ss, "HISTORICO_CRM");
    var tarefasRaw = readSheetObjects(ss, "TAREFAS");
    var logsRaw = readSheetObjects(ss, "LOGS");

    if (
      eventosRaw.length === 0 &&
      leadsRaw.length === 0 &&
      agendamentosRaw.length === 0 &&
      configRaw.length === 0
    ) {
      return null;
    }

    return {
      config: configRaw.map(function(c) {
        return {
          chave: String(c.chave || ""),
          valor: String(c.valor || ""),
          descricao: String(c.descricao || ""),
          atualizado_em: String(c.atualizado_em || "")
        };
      }),
      usuarios: usuariosRaw.map(function(u) {
        return {
          id_usuario: String(u.id_usuario || ""),
          nome: String(u.nome || ""),
          email: String(u.email || ""),
          senha: u.senha ? String(u.senha) : (String(u.id_usuario || "") === "USR-001" ? "admin" : undefined),
          foto_url: u.foto_url ? String(u.foto_url) : undefined,
          telefone: u.telefone ? String(u.telefone) : undefined,
          cargo: u.cargo ? String(u.cargo) : undefined,
          departamento: u.departamento ? String(u.departamento) : undefined,
          observacoes: u.observacoes ? String(u.observacoes) : undefined,
          perfil: String(u.perfil || "ADMIN"),
          permissoes: parseJsonCell(u.permissoes, undefined),
          ativo: u.ativo !== false && String(u.ativo).toLowerCase() !== "false",
          criado_em: String(u.criado_em || ""),
          atualizado_em: u.atualizado_em ? String(u.atualizado_em) : undefined
        };
      }),
      eventos: eventosRaw.map(function(ev) {
        return {
          id_evento: String(ev.id_evento || ""),
          slug: String(ev.slug || ""),
          nome: String(ev.nome || ""),
          descricao: String(ev.descricao || ""),
          imagem_url: ev.imagem_url ? String(ev.imagem_url) : undefined,
          produto_nome: ev.produto_nome ? String(ev.produto_nome) : undefined,
          produto_valor_mensal: Number(ev.produto_valor_mensal) || 0,
          produto_parcelas: Number(ev.produto_parcelas) || 1,
          produto_valor: Number(ev.produto_valor) || 0,
          exibir_produto_publico: ev.exibir_produto_publico === true || String(ev.exibir_produto_publico).toLowerCase() === "true",
          solicitar_local: ev.solicitar_local === true || String(ev.solicitar_local).toLowerCase() === "true",
          label_local: ev.label_local ? String(ev.label_local) : undefined,
          local_opcoes: parseJsonCell(ev.local_opcoes, []),
          modo_datas: ev.modo_datas ? String(ev.modo_datas) : undefined,
          recorrencia_ativa: ev.recorrencia_ativa === true || String(ev.recorrencia_ativa).toLowerCase() === "true",
          datas_especificas: parseJsonCell(ev.datas_especificas, []),
          data_inicio: String(ev.data_inicio || ""),
          data_fim: String(ev.data_fim || ""),
          dias_semana: parseJsonCell(ev.dias_semana, []),
          duracao_minutos: Number(ev.duracao_minutos) || 60,
          intervalo_minutos: Number(ev.intervalo_minutos) || 0,
          capacidade_padrao: Number(ev.capacidade_padrao) || 1,
          responsavel_id: String(ev.responsavel_id || "USR-001"),
          status: String(ev.status || "PUBLICADO"),
          agenda_publica_ativa: ev.agenda_publica_ativa !== false && String(ev.agenda_publica_ativa).toLowerCase() !== "false",
          motivo_indisponivel: ev.motivo_indisponivel ? String(ev.motivo_indisponivel) : undefined,
          mensagem_indisponivel: ev.mensagem_indisponivel ? String(ev.mensagem_indisponivel) : undefined,
          permitir_lista_espera: ev.permitir_lista_espera !== false && String(ev.permitir_lista_espera).toLowerCase() !== "false",
          mensagem_confirmacao: String(ev.mensagem_confirmacao || ""),
          permite_cancelamento: ev.permite_cancelamento !== false && String(ev.permite_cancelamento).toLowerCase() !== "false",
          horas_antecedencia_cancelamento: Number(ev.horas_antecedencia_cancelamento) || 24,
          visitas: Number(ev.visitas) || 0,
          criado_em: String(ev.criado_em || ""),
          atualizado_em: String(ev.atualizado_em || "")
        };
      }),
      horarios: horariosRaw.map(function(h) {
        return {
          id_horario: String(h.id_horario || ""),
          id_evento: String(h.id_evento || ""),
          hora_inicio: String(h.hora_inicio || ""),
          hora_fim: String(h.hora_fim || ""),
          capacidade: Number(h.capacidade) || 1,
          dias_aplicaveis: parseJsonCell(h.dias_aplicaveis, []),
          ativo: h.ativo !== false && String(h.ativo).toLowerCase() !== "false"
        };
      }),
      bloqueios: bloqueiosRaw.map(function(b) {
        return {
          id_bloqueio: String(b.id_bloqueio || ""),
          id_evento: String(b.id_evento || "*"),
          data: String(b.data || ""),
          hora_inicio: String(b.hora_inicio || ""),
          hora_fim: String(b.hora_fim || ""),
          motivo: String(b.motivo || ""),
          criado_por: String(b.criado_por || ""),
          criado_em: String(b.criado_em || "")
        };
      }),
      agendamentos: agendamentosRaw.map(function(a) {
        return {
          id_agendamento: String(a.id_agendamento || ""),
          protocolo: String(a.protocolo || ""),
          id_evento: String(a.id_evento || ""),
          id_lead: String(a.id_lead || ""),
          data_agendamento: String(a.data_agendamento || ""),
          hora_inicio: String(a.hora_inicio || ""),
          hora_fim: String(a.hora_fim || ""),
          status: String(a.status || "CONFIRMADO"),
          motivo_cancelamento: a.motivo_cancelamento ? String(a.motivo_cancelamento) : undefined,
          cancelado_em: a.cancelado_em ? String(a.cancelado_em) : undefined,
          criado_em: String(a.criado_em || "")
        };
      }),
      leads: leadsRaw.map(function(l) {
        return {
          id_lead: String(l.id_lead || ""),
          nome: String(l.nome || ""),
          whatsapp: String(l.whatsapp || ""),
          email: String(l.email || ""),
          empresa: l.empresa ? String(l.empresa) : "",
          cargo: l.cargo ? String(l.cargo) : "",
          local: l.local ? String(l.local) : undefined,
          status_cliente: String(l.status_cliente || "LEAD"),
          origem_primeiro_evento: String(l.origem_primeiro_evento || ""),
          total_agendamentos: Number(l.total_agendamentos) || 0,
          data_ultimo_agendamento: String(l.data_ultimo_agendamento || ""),
          responsavel_id: String(l.responsavel_id || "USR-001"),
          observacoes: l.observacoes ? String(l.observacoes) : "",
          excluido: l.excluido === true || String(l.excluido).toLowerCase() === "true",
          excluido_em: l.excluido_em ? String(l.excluido_em) : undefined,
          criado_em: String(l.criado_em || ""),
          atualizado_em: String(l.atualizado_em || "")
        };
      }),
      campos_formulario: camposRaw.map(function(f) {
        return {
          id_campo: String(f.id_campo || ""),
          id_evento: String(f.id_evento || ""),
          nome_campo: String(f.nome_campo || ""),
          label: String(f.label || ""),
          tipo: String(f.tipo || "TEXTO_CURTO"),
          obrigatorio: f.obrigatorio === true || String(f.obrigatorio).toLowerCase() === "true",
          placeholder: f.placeholder ? String(f.placeholder) : undefined,
          opcoes: parseJsonCell(f.opcoes, undefined),
          ordem: Number(f.ordem) || 1,
          ativo: f.ativo !== false && String(f.ativo).toLowerCase() !== "false"
        };
      }),
      respostas: respostasRaw.map(function(r) {
        return {
          id_resposta: String(r.id_resposta || ""),
          id_agendamento: String(r.id_agendamento || ""),
          id_lead: String(r.id_lead || ""),
          id_campo: String(r.id_campo || ""),
          valor: String(r.valor || ""),
          criado_em: String(r.criado_em || "")
        };
      }),
      crm: crmRaw.map(function(c) {
        return {
          id_oportunidade: String(c.id_oportunidade || ""),
          id_lead: String(c.id_lead || ""),
          id_agendamento_origem: c.id_agendamento_origem ? String(c.id_agendamento_origem) : undefined,
          titulo: String(c.titulo || ""),
          produto_nome: c.produto_nome ? String(c.produto_nome) : undefined,
          produto_valor_mensal: Number(c.produto_valor_mensal) || 0,
          produto_parcelas: Number(c.produto_parcelas) || 1,
          estagio: String(c.estagio || "ENTRADA"),
          sub_status: c.sub_status ? String(c.sub_status) : "FOLLOW",
          valor_estimado: Number(c.valor_estimado) || 0,
          valor_fechado: Number(c.valor_fechado) || 0,
          responsavel_id: String(c.responsavel_id || "USR-001"),
          data_proximo_followup: c.data_proximo_followup ? String(c.data_proximo_followup) : undefined,
          motivo_perda: c.motivo_perda ? String(c.motivo_perda) : undefined,
          data_fechamento: c.data_fechamento ? String(c.data_fechamento) : undefined,
          ordem_coluna: Number(c.ordem_coluna) || 1,
          criado_em: String(c.criado_em || ""),
          atualizado_em: String(c.atualizado_em || "")
        };
      }),
      historico_crm: histCrmRaw.map(function(hc) {
        return {
          id_historico: String(hc.id_historico || ""),
          id_oportunidade: String(hc.id_oportunidade || ""),
          tipo: String(hc.tipo || "NOTA"),
          estagio_anterior: hc.estagio_anterior ? String(hc.estagio_anterior) : undefined,
          estagio_novo: hc.estagio_novo ? String(hc.estagio_novo) : undefined,
          descricao: String(hc.descricao || ""),
          usuario_id: String(hc.usuario_id || "USR-001"),
          criado_em: String(hc.criado_em || "")
        };
      }),
      tarefas: tarefasRaw.map(function(t) {
        return {
          id_tarefa: String(t.id_tarefa || ""),
          id_oportunidade: String(t.id_oportunidade || ""),
          id_lead: t.id_lead ? String(t.id_lead) : undefined,
          titulo: String(t.titulo || ""),
          descricao: t.descricao ? String(t.descricao) : undefined,
          data_vencimento: String(t.data_vencimento || ""),
          concluida: t.concluida === true || String(t.concluida).toLowerCase() === "true",
          responsavel_id: String(t.responsavel_id || "USR-001"),
          criada_em: String(t.criada_em || ""),
          concluida_em: t.concluida_em ? String(t.concluida_em) : undefined
        };
      }),
      logs: logsRaw.map(function(lg) {
        return {
          id_log: String(lg.id_log || ""),
          nivel: String(lg.nivel || "INFO"),
          origem: String(lg.origem || "SHEETS"),
          acao: String(lg.acao || ""),
          detalhes: String(lg.detalhes || ""),
          ip_ou_user_agent: lg.ip_ou_user_agent ? String(lg.ip_ou_user_agent) : undefined,
          timestamp: String(lg.timestamp || "")
        };
      })
    };
  } catch (eSheet) {
    return null;
  }
}

function getRootJsonFileFast(folder) {
  var props = PropertiesService.getScriptProperties();
  var cachedId = props.getProperty("PROP_ROOT_JSON_ID");
  if (cachedId) {
    try {
      var f = DriveApp.getFileById(cachedId);
      if (f && !f.isTrashed()) return f;
    } catch (e) {}
  }
  var rootFiles = folder.getFilesByName(ROOT_FILE_NAME);
  if (rootFiles.hasNext()) {
    var found = rootFiles.next();
    try { props.setProperty("PROP_ROOT_JSON_ID", found.getId()); } catch (e) {}
    return found;
  }
  return null;
}

function loadAuthoritativeDatabaseFast(folder, bypassCache) {
  if (!bypassCache) {
    var cached = getFromCache(CACHE_KEY_ROOT);
    if (cached) {
      try {
        var parsedCache = JSON.parse(cached);
        if (parsedCache && Array.isArray(parsedCache.eventos)) return parsedCache;
      } catch (eC) {}
    }
  }
  var rootFile = getRootJsonFileFast(folder);
  if (rootFile) {
    try {
      var parsedFile = JSON.parse(rootFile.getBlob().getDataAsString("UTF-8"));
      if (parsedFile && typeof parsedFile === "object" && Array.isArray(parsedFile.eventos)) {
        return parsedFile;
      }
    } catch (eDb) {}
  }
  var fromSheets = readDatabaseFromSheets(folder);
  if (fromSheets) {
    try { upsertRootJsonFileFast(folder, JSON.stringify(fromSheets)); } catch (eUp) {}
    return fromSheets;
  }
  return {};
}

function loadAuthoritativeDatabase(folder, bypassCache) {
  return loadAuthoritativeDatabaseFast(folder, bypassCache);
}

function upsertRootJsonFileFast(folder, jsonContent) {
  var props = PropertiesService.getScriptProperties();
  var cachedId = props.getProperty("PROP_ROOT_JSON_ID");
  if (cachedId) {
    try {
      var existing = DriveApp.getFileById(cachedId);
      if (existing && !existing.isTrashed()) {
        existing.setContent(jsonContent);
        return existing;
      }
    } catch (e) {}
  }
  var saved = upsertRootJsonFile(folder, jsonContent);
  try { props.setProperty("PROP_ROOT_JSON_ID", saved.getId()); } catch (e) {}
  return saved;
}

function upsertRootJsonFile(folder, jsonContent) {
  var files = folder.getFilesByName(ROOT_FILE_NAME);
  if (files.hasNext()) {
    var primary = files.next();
    primary.setContent(jsonContent);
    while (files.hasNext()) {
      try { files.next().setTrashed(true); } catch (ignore) {}
    }
    return primary;
  }
  return folder.createFile(ROOT_FILE_NAME, jsonContent, MimeType.PLAIN_TEXT);
}

function ensureNativeUuids(db) {
  if (!db || typeof db !== "object") return;
  var idMap = {
    eventos: "id_evento",
    horarios: "id_horario",
    bloqueios: "id_bloqueio",
    agendamentos: "id_agendamento",
    leads: "id_lead",
    campos_formulario: "id_campo",
    respostas: "id_resposta",
    crm: "id_oportunidade",
    historico_crm: "id_historico",
    tarefas: "id_tarefa",
    logs: "id_log"
  };
  for (var col in idMap) {
    var arr = db[col];
    var idField = idMap[col];
    if (Array.isArray(arr)) {
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] && !arr[i][idField]) {
          arr[i][idField] = Utilities.getUuid();
        }
      }
    }
  }
}

function trimLogsInDb(db) {
  if (db && Array.isArray(db.logs) && db.logs.length > MAX_LOGS_IN_ROOT) {
    db.logs = db.logs.slice(0, MAX_LOGS_IN_ROOT);
  }
}

function validateSecurityToken(e, payload) {
  var scriptSecret = PropertiesService.getScriptProperties().getProperty("API_SECRET") || "";
  if (!scriptSecret) return { valid: true };
  var providedToken =
    (payload && (payload.apiToken || payload.token)) ||
    (e && e.parameter && (e.parameter.apiToken || e.parameter.token)) ||
    "";
  if (String(providedToken).trim() === String(scriptSecret).trim()) {
    return { valid: true };
  }
  return { valid: false, error: "Acesso não autorizado: API Secret inválida ou ausente." };
}

function getFromCache(key) {
  try {
    var cache = CacheService.getScriptCache();
    var metaRaw = cache.get(key + "_META");
    if (metaRaw) {
      var meta = JSON.parse(metaRaw);
      var parts = [];
      for (var i = 0; i < meta.chunks; i++) {
        var chunk = cache.get(key + "_P" + i);
        if (chunk === null) return null;
        parts.push(chunk);
      }
      return parts.join("");
    }
    return cache.get(key);
  } catch (e) {
    return null;
  }
}

function putToCache(key, valueStr, ttl) {
  try {
    if (!valueStr) return;
    var cache = CacheService.getScriptCache();
    var ttlSec = ttl || CACHE_TTL_SECONDS;
    if (valueStr.length <= CACHE_CHUNK_SIZE) {
      cache.remove(key + "_META");
      cache.put(key, valueStr, ttlSec);
      return;
    }
    var chunks = Math.ceil(valueStr.length / CACHE_CHUNK_SIZE);
    if (chunks > 12) return; // Evita estourar cota de cache se JSON > ~960KB
    var map = {};
    for (var i = 0; i < chunks; i++) {
      map[key + "_P" + i] = valueStr.slice(i * CACHE_CHUNK_SIZE, (i + 1) * CACHE_CHUNK_SIZE);
    }
    map[key + "_META"] = JSON.stringify({ chunks: chunks });
    cache.putAll(map, ttlSec);
  } catch (e) {}
}

function invalidateDatabaseCache() {
  try {
    var cache = CacheService.getScriptCache();
    cache.remove(CACHE_KEY_ROOT);
    cache.remove(CACHE_KEY_ROOT + "_META");
  } catch (e) {}
}

function getOrCreateSpreadsheet(folder) {
  var props = PropertiesService.getScriptProperties();
  var cachedSsId = props.getProperty("PROP_SPREADSHEET_ID");
  if (cachedSsId) {
    try {
      var ssCached = SpreadsheetApp.openById(cachedSsId);
      if (ssCached) return ssCached;
    } catch (e) {}
  }
  try {
    var files = folder.getFilesByName(SPREADSHEET_BASE_NAME);
    if (files.hasNext()) {
      var ssFileFound = files.next();
      try { props.setProperty("PROP_SPREADSHEET_ID", ssFileFound.getId()); } catch (e) {}
      return SpreadsheetApp.openById(ssFileFound.getId());
    }
  } catch (e) {}
  var newSs = SpreadsheetApp.create(SPREADSHEET_BASE_NAME);
  var ssFile = DriveApp.getFileById(newSs.getId());
  try { ssFile.moveTo(folder); } catch (e) { folder.addFile(ssFile); }
  try { props.setProperty("PROP_SPREADSHEET_ID", newSs.getId()); } catch (e) {}
  return newSs;
}

function getOrCreateSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var def = ss.getSheetByName("Página1") || ss.getSheetByName("Sheet1");
    if (def && ss.getSheets().length > 1) {
      try { ss.deleteSheet(def); } catch (e) {}
    }
  }
  if (headers && (sheet.getLastRow() === 0 || sheet.getLastColumn() < headers.length)) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#0F172A").setFontColor("#FFFFFF");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function mergeDatabaseObjects(existing, incoming) {
  if (!existing) return incoming;
  if (!incoming) return existing;
  var result = Object.assign({}, incoming);
  for (var key in existing) {
    if (incoming[key] === undefined) result[key] = existing[key];
  }
  return result;
}

function getCachedDriveFolder(propKey, folderName, parentFolder) {
  var props = PropertiesService.getScriptProperties();
  var cachedId = props.getProperty(propKey);
  if (cachedId) {
    try {
      var fCached = DriveApp.getFolderById(cachedId);
      if (fCached && !fCached.isTrashed()) return fCached;
    } catch (e) {}
  }
  var resolved = getOrCreateFolder(folderName, parentFolder);
  try { props.setProperty(propKey, resolved.getId()); } catch (e) {}
  return resolved;
}

function getDataFolderFast() {
  var rootFolder = getCachedDriveFolder("PROP_ROOT_FOLDER_ID", ROOT_FOLDER_NAME, null);
  return getCachedDriveFolder("PROP_DATA_FOLDER_ID", DATA_FOLDER_NAME, rootFolder);
}

function getAgendaAtivaFolders() {
  var rootFolder = getCachedDriveFolder("PROP_ROOT_FOLDER_ID", ROOT_FOLDER_NAME, null);
  return {
    root: rootFolder,
    data: getCachedDriveFolder("PROP_DATA_FOLDER_ID", DATA_FOLDER_NAME, rootFolder),
    backup: getCachedDriveFolder("PROP_BACKUP_FOLDER_ID", BACKUP_FOLDER_NAME, rootFolder),
    media: getCachedDriveFolder("PROP_MEDIA_FOLDER_ID", MEDIA_FOLDER_NAME, rootFolder)
  };
}

function getOrCreateFolder(folderName, parentFolder) {
  var target = parentFolder ? parentFolder : DriveApp;
  var folders = target.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return parentFolder ? parentFolder.createFolder(folderName) : DriveApp.createFolder(folderName);
}

function setupDailyBackupTrigger() {
  try {
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty("PROP_DAILY_TRIGGER_OK") === "1") return;
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === "runDailyBackup") {
        props.setProperty("PROP_DAILY_TRIGGER_OK", "1");
        return;
      }
    }
    ScriptApp.newTrigger("runDailyBackup").timeBased().everyDays(1).atHour(0).create();
    props.setProperty("PROP_DAILY_TRIGGER_OK", "1");
  } catch (e) {}
}

function runDailyBackup() {
  try {
    var folders = getAgendaAtivaFolders();
    var ss = getOrCreateSpreadsheet(folders.data);
    var timestamp = formatDate(new Date());
    DriveApp.getFileById(ss.getId()).makeCopy("BACKUP_SHEETS_" + timestamp, folders.backup);

    var rootFiles = folders.data.getFilesByName(ROOT_FILE_NAME);
    if (rootFiles.hasNext()) {
      rootFiles.next().makeCopy("BACKUP_JSON_" + timestamp + ".json", folders.backup);
    }
  } catch (e) {}
}

function jsonResponse(obj, statusCode) {
  var isErr = obj && (obj.status === "error" || obj.status === "unauthorized");
  var response = Object.assign({
    success: !isErr,
    status: isErr ? (obj.status || "error") : "success",
    statusCode: statusCode || (isErr ? 400 : 200),
    timestamp: new Date().toISOString()
  }, obj);
  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
}

function formatDate(date) {
  var pad = function(n) { return n < 10 ? "0" + n : n; };
  return pad(date.getDate()) + "-" + pad(date.getMonth() + 1) + "-" + date.getFullYear() + "-" + pad(date.getHours()) + ":" + pad(date.getMinutes());
}
