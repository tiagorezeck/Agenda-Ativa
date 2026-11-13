// =========================================================================
// AGENDA ATIVA — MOTOR UNIVERSAL v2.0 (DADOS DRIVE + SHEETS BATCH + ENGSEG)
// Arquitetura Híbrida: Google Drive (JSON Mestre) + Sheets (Batch) + GAS
// =========================================================================
//
// INSTRUÇÕES DE IMPLANTAÇÃO:
// 1. Acesse script.new (ou Extensões > Apps Script na sua planilha).
// 2. Cole este código em Code.gs (e opcionalmente SetupSheet.gs).
// 3. Clique em Implantar > Nova Implantação > Tipo: App da Web.
// 4. Executar como: "Eu" | Quem tem acesso: "Qualquer pessoa".
// 5. Copie a URL /exec e cole em Configurações > Motor DADOS DRIVE v2.0.
// =========================================================================

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
  USUARIOS: ["id_usuario", "nome", "email", "perfil", "ativo", "criado_em"],
  EVENTOS: [
    "id_evento", "slug", "nome", "descricao", "imagem_url",
    "data_inicio", "data_fim", "dias_semana", "duracao_minutos",
    "intervalo_minutos", "capacidade_padrao", "responsavel_id",
    "status", "mensagem_confirmacao", "permite_cancelamento",
    "horas_antecedencia_cancelamento", "criado_em", "atualizado_em"
  ],
  HORARIOS: ["id_horario", "id_evento", "hora_inicio", "hora_fim", "capacidade", "dias_aplicaveis", "ativo"],
  BLOQUEIOS: ["id_bloqueio", "id_evento", "data", "hora_inicio", "hora_fim", "motivo", "criado_por", "criado_em"],
  AGENDAMENTOS: [
    "id_agendamento", "protocolo", "id_evento", "id_lead",
    "data_agendamento", "hora_inicio", "hora_fim", "status",
    "motivo_cancelamento", "cancelado_em", "criado_em"
  ],
  LEADS: [
    "id_lead", "nome", "whatsapp", "email", "empresa", "cargo",
    "origem_primeiro_evento", "total_agendamentos", "data_ultimo_agendamento",
    "responsavel_id", "observacoes", "criado_em", "atualizado_em"
  ],
  CAMPOS_FORMULARIO: [
    "id_campo", "id_evento", "nome_campo", "label", "tipo",
    "obrigatorio", "placeholder", "opcoes", "ordem", "ativo"
  ],
  RESPOSTAS: ["id_resposta", "id_agendamento", "id_lead", "id_campo", "valor", "criado_em"],
  CRM: [
    "id_oportunidade", "id_lead", "id_agendamento_origem", "titulo",
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
// DO GET (CONSULTAS RÁPIDAS COM CACHE <100ms, PING, LISTAGEM, ARQUIVOS)
// =========================================================================
function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || "get";

    // 0. Validação de Token de Segurança (API_SECRET)
    var auth = validateSecurityToken(e, null);
    if (!auth.valid) {
      return jsonResponse({ status: "unauthorized", statusCode: 401, message: auth.error }, 401);
    }

    var folders = getAgendaAtivaFolders();
    var folder = folders.data;

    // 1. PING / TESTE DE CONEXÃO
    if (action === "ping" || action === "test") {
      var ss = getOrCreateSpreadsheet(folder);
      setupDailyBackupTrigger();

      var exportUrl = "https://docs.google.com/spreadsheets/d/" + ss.getId() + "/export?format=xlsx";
      var scriptSecret = PropertiesService.getScriptProperties().getProperty("API_SECRET") || "";
      var rootFiles = folder.getFilesByName(ROOT_FILE_NAME);
      var hasDatabase = rootFiles.hasNext();

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
        version: "2.0-Enterprise",
        timestamp: new Date().getTime(),
        message: "Conexão ativa! Agenda Ativa Motor v2.0 pronto (" + ss.getName() + ")."
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

    // 4. BUSCAR EVENTO PÚBLICO POR SLUG
    if (action === "GET_EVENT_BY_SLUG") {
      var dbCachedOrDisk = loadAuthoritativeDatabase(folder, Boolean(params.nocache));
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

    // 5. GET PADRÃO (get / GET_DATABASE) COM CACHE EM MEMÓRIA CHUNKED
    if (!params.nocache) {
      var cachedRoot = getFromCache(CACHE_KEY_ROOT);
      if (cachedRoot) {
        if (action === "GET_DATABASE") {
          return jsonResponse({ status: "success", data: JSON.parse(cachedRoot), cached: true });
        }
        return ContentService.createTextOutput(cachedRoot).setMimeType(ContentService.MimeType.JSON);
      }
    }

    var dbData = loadAuthoritativeDatabase(folder, true);
    var serializedData = JSON.stringify(dbData);
    putToCache(CACHE_KEY_ROOT, serializedData, CACHE_TTL_SECONDS);

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
    var folders = getAgendaAtivaFolders();
    var folder = folders.data;
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
      var cpSource = payload.data || loadAuthoritativeDatabase(folder, true);
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

      upsertRootJsonFile(folder, JSON.stringify(parsedContent, null, 2));
      syncDataToGoogleSheets(spreadsheet, parsedContent);
      putToCache(CACHE_KEY_ROOT, JSON.stringify(parsedContent), CACHE_TTL_SECONDS);

      return jsonResponse({ status: "success", data: parsedContent, content: parsedContent, message: "Checkpoint restaurado como banco principal." });
    }

    // 4. OPERAÇÃO ATÔMICA DE AGENDAMENTO PÚBLICO (ANTI-OVERBOOKING SOB LOCK)
    if (action === "CREATE_BOOKING") {
      var currentDb = loadAuthoritativeDatabase(folder, true);
      var bookingInput = payload.data || payload.payload || payload;
      var bookingOutcome = executeAtomicBookingOnDb(currentDb, bookingInput);
      if (!bookingOutcome.success) {
        return jsonResponse({ status: "error", statusCode: 409, message: bookingOutcome.error }, 409);
      }

      trimLogsInDb(currentDb);
      var serializedBookingDb = JSON.stringify(currentDb);
      upsertRootJsonFile(folder, JSON.stringify(currentDb, null, 2));
      syncDataToGoogleSheets(spreadsheet, currentDb);
      putToCache(CACHE_KEY_ROOT, serializedBookingDb, CACHE_TTL_SECONDS);
      setupDailyBackupTrigger();

      return jsonResponse({
        status: "success",
        data: bookingOutcome.data,
        database: currentDb,
        spreadsheetUrl: spreadsheet.getUrl()
      });
    }

    // 4B. CANCELAMENTO ATÔMICO PELO CLIENTE OU ADMIN (SOB LOCK)
    if (action === "CANCEL_BOOKING") {
      var dbCancel = loadAuthoritativeDatabase(folder, true);
      var cancelInput = payload.data || payload.payload || payload;
      var cancelOutcome = executeAtomicCancelOnDb(dbCancel, cancelInput);
      if (!cancelOutcome.success) {
        return jsonResponse({ status: "error", statusCode: 400, message: cancelOutcome.error }, 400);
      }

      trimLogsInDb(dbCancel);
      upsertRootJsonFile(folder, JSON.stringify(dbCancel, null, 2));
      syncDataToGoogleSheets(spreadsheet, dbCancel);
      putToCache(CACHE_KEY_ROOT, JSON.stringify(dbCancel), CACHE_TTL_SECONDS);

      return jsonResponse({
        status: "success",
        data: cancelOutcome.data,
        database: dbCancel
      });
    }

    // 4C. REMARCAÇÃO ATÔMICA PELO CLIENTE (SOB LOCK)
    if (action === "RESCHEDULE_BOOKING") {
      var dbResched = loadAuthoritativeDatabase(folder, true);
      var reschedInput = payload.data || payload.payload || payload;
      var reschedOutcome = executeAtomicRescheduleOnDb(dbResched, reschedInput);
      if (!reschedOutcome.success) {
        return jsonResponse({ status: "error", statusCode: 409, message: reschedOutcome.error }, 409);
      }

      trimLogsInDb(dbResched);
      upsertRootJsonFile(folder, JSON.stringify(dbResched, null, 2));
      syncDataToGoogleSheets(spreadsheet, dbResched);
      putToCache(CACHE_KEY_ROOT, JSON.stringify(dbResched), CACHE_TTL_SECONDS);

      return jsonResponse({
        status: "success",
        data: reschedOutcome.data,
        database: dbResched
      });
    }

    // 5. SALVAR / SINCRONIZAR BANCO GERAL (save)
    var incomingData = payload.data || payload.payload || payload;
    var existingData = loadAuthoritativeDatabase(folder, true);
    var mergedData = mergeDatabaseObjects(existingData, incomingData);
    ensureNativeUuids(mergedData);
    trimLogsInDb(mergedData);

    upsertRootJsonFile(folder, JSON.stringify(mergedData, null, 2));
    syncDataToGoogleSheets(spreadsheet, mergedData);
    putToCache(CACHE_KEY_ROOT, JSON.stringify(mergedData), CACHE_TTL_SECONDS);
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
  if (evento.status !== "PUBLICADO") return { success: false, error: "Este evento não está aberto para agendamentos." };

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

  var leadEncontrado = null;
  for (var l = 0; l < db.leads.length; l++) {
    var lObj = db.leads[l];
    var lZap = String(lObj.whatsapp || "").replace(/\D/g, "");
    var lEmail = String(lObj.email || "").trim().toLowerCase();
    if ((whatsappNorm && lZap === whatsappNorm) || (emailNorm && lEmail === emailNorm)) {
      leadEncontrado = lObj;
      break;
    }
  }

  var idLead = "";
  if (leadEncontrado) {
    idLead = leadEncontrado.id_lead;
    leadEncontrado.nome = bookingData.nome || leadEncontrado.nome;
    if (bookingData.empresa) leadEncontrado.empresa = bookingData.empresa;
    leadEncontrado.total_agendamentos = (Number(leadEncontrado.total_agendamentos) || 0) + 1;
    leadEncontrado.data_ultimo_agendamento = nowIso;
    leadEncontrado.atualizado_em = nowIso;
  } else {
    idLead = "LED-" + Utilities.getUuid().slice(0, 8).toUpperCase();
    db.leads.unshift({
      id_lead: idLead,
      nome: bookingData.nome,
      whatsapp: whatsappNorm,
      email: emailNorm,
      empresa: bookingData.empresa || "",
      cargo: "",
      origem_primeiro_evento: evento.id_evento,
      total_agendamentos: 1,
      data_ultimo_agendamento: nowIso,
      responsavel_id: evento.responsavel_id || "USR-001",
      observacoes: "Lead captado automaticamente pelo evento " + evento.nome,
      criado_em: nowIso,
      atualizado_em: nowIso
    });
  }

  var dataFmt = String(bookingData.data || "").replace(/-/g, "");
  var rand4 = Utilities.getUuid().slice(0, 4).toUpperCase();
  var protocolo = "PROT-" + dataFmt + "-" + rand4;
  var idAgendamento = "AGD-" + dataFmt + "-" + Utilities.getUuid().slice(0, 6).toUpperCase();

  db.agendamentos.unshift({
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
  });

  if (bookingData.respostas_customizadas) {
    for (var campoId in bookingData.respostas_customizadas) {
      var val = bookingData.respostas_customizadas[campoId];
      if (val !== undefined && val !== null && val !== "") {
        db.respostas.push({
          id_resposta: "RSP-" + Utilities.getUuid().slice(0, 8).toUpperCase(),
          id_agendamento: idAgendamento,
          id_lead: idLead,
          id_campo: campoId,
          valor: String(val),
          criado_em: nowIso
        });
      }
    }
  }

  var idOportunidade = "CRM-" + Utilities.getUuid().slice(0, 8).toUpperCase();
  db.crm.unshift({
    id_oportunidade: idOportunidade,
    id_lead: idLead,
    id_agendamento_origem: idAgendamento,
    titulo: "Atendimento: " + bookingData.nome + " (" + evento.nome + ")",
    estagio: "ENTRADA",
    sub_status: "FOLLOW",
    valor_estimado: 0,
    valor_fechado: 0,
    responsavel_id: evento.responsavel_id || "USR-001",
    data_proximo_followup: bookingData.data,
    motivo_perda: "",
    data_fechamento: "",
    ordem_coluna: 1,
    criado_em: nowIso,
    atualizado_em: nowIso
  });

  db.historico_crm.unshift({
    id_historico: "HCRM-" + Utilities.getUuid().slice(0, 8).toUpperCase(),
    id_oportunidade: idOportunidade,
    tipo: "MUDANCA_ESTAGIO",
    estagio_anterior: "",
    estagio_novo: "ENTRADA",
    descricao: "Oportunidade gerada automaticamente a partir do agendamento " + protocolo,
    usuario_id: "SISTEMA",
    criado_em: nowIso
  });

  db.logs.unshift({
    id_log: "LOG-" + Utilities.getUuid().slice(0, 8).toUpperCase(),
    nivel: "INFO",
    origem: "GAS_V2",
    acao: "BOOKING_CONFIRMED",
    detalhes: "Agendamento " + protocolo + " gravado com LockService.",
    ip_ou_user_agent: "",
    timestamp: nowIso
  });

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

// =========================================================================
// ESPELHAMENTO EM BLOCO DAS 13 ABAS NO SHEETS (BATCH PROCESSING)
// =========================================================================
function syncDataToGoogleSheets(ss, data) {
  if (!data || typeof data !== "object") return;

  mirrorArrayToSheet(ss, "CONFIG", SHEETS_SCHEMA.CONFIG, data.config, function(c) {
    return [c.chave || "", c.valor || "", c.descricao || "", c.atualizado_em || ""];
  });

  mirrorArrayToSheet(ss, "USUARIOS", SHEETS_SCHEMA.USUARIOS, data.usuarios, function(u) {
    return [u.id_usuario || Utilities.getUuid(), u.nome || "", u.email || "", u.perfil || "", u.ativo !== false, u.criado_em || ""];
  });

  mirrorArrayToSheet(ss, "EVENTOS", SHEETS_SCHEMA.EVENTOS, data.eventos, function(ev) {
    return [
      ev.id_evento || Utilities.getUuid(), ev.slug || "", ev.nome || "", ev.descricao || "", ev.imagem_url || "",
      ev.data_inicio || "", ev.data_fim || "", JSON.stringify(ev.dias_semana || []),
      Number(ev.duracao_minutos) || 60, Number(ev.intervalo_minutos) || 0, Number(ev.capacidade_padrao) || 1,
      ev.responsavel_id || "", ev.status || "PUBLICADO", ev.mensagem_confirmacao || "",
      ev.permite_cancelamento !== false, Number(ev.horas_antecedencia_cancelamento) || 24,
      ev.criado_em || "", ev.atualizado_em || ""
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
      l.empresa || "", l.cargo || "", l.origem_primeiro_evento || "",
      Number(l.total_agendamentos) || 0, l.data_ultimo_agendamento || "",
      l.responsavel_id || "", l.observacoes || "", l.criado_em || "", l.atualizado_em || ""
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
      c.titulo || "", c.estagio || "ENTRADA", c.sub_status || "FOLLOW",
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

// =========================================================================
// HELPERS DRIVE JSON, CACHE CHUNKED, UUID, SEGURANÇA E BACKUP
// =========================================================================
function loadAuthoritativeDatabase(folder, bypassCache) {
  if (!bypassCache) {
    var cached = getFromCache(CACHE_KEY_ROOT);
    if (cached) {
      try { return JSON.parse(cached) || {}; } catch (eC) {}
    }
  }
  var rootFiles = folder.getFilesByName(ROOT_FILE_NAME);
  if (rootFiles.hasNext()) {
    try {
      return JSON.parse(rootFiles.next().getBlob().getDataAsString("UTF-8")) || {};
    } catch (eDb) {}
  }
  return {};
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
  try {
    var files = folder.getFilesByName(SPREADSHEET_BASE_NAME);
    if (files.hasNext()) return SpreadsheetApp.openById(files.next().getId());
  } catch (e) {}
  var newSs = SpreadsheetApp.create(SPREADSHEET_BASE_NAME);
  var ssFile = DriveApp.getFileById(newSs.getId());
  try { ssFile.moveTo(folder); } catch (e) { folder.addFile(ssFile); }
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
  if (headers && sheet.getLastRow() === 0) {
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

function getAgendaAtivaFolders() {
  var rootFolder = getOrCreateFolder(ROOT_FOLDER_NAME);
  return {
    root: rootFolder,
    data: getOrCreateFolder(DATA_FOLDER_NAME, rootFolder),
    backup: getOrCreateFolder(BACKUP_FOLDER_NAME, rootFolder),
    media: getOrCreateFolder(MEDIA_FOLDER_NAME, rootFolder)
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
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === "runDailyBackup") return;
    }
    ScriptApp.newTrigger("runDailyBackup").timeBased().everyDays(1).atHour(0).create();
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
