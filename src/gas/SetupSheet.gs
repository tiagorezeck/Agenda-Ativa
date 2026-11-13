/**
 * =========================================================================
 * INSTALADOR AUTOMÁTICO DO BANCO DE DADOS (GOOGLE SHEETS)
 * Criação das 13 Abas Oficiais com Cabeçalhos e Formatação Profissional
 * =========================================================================
 * 
 * Execute a função 'inicializarPlanilha()' a partir do editor Apps Script.
 */

function inicializarPlanilha() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var schemas = {
    CONFIG: [
      'chave', 'valor', 'descricao', 'atualizado_em'
    ],
    USUARIOS: [
      'id_usuario', 'nome', 'email', 'perfil', 'ativo', 'criado_em'
    ],
    EVENTOS: [
      'id_evento', 'slug', 'nome', 'descricao', 'imagem_url',
      'data_inicio', 'data_fim', 'dias_semana', 'duracao_minutos',
      'intervalo_minutos', 'capacidade_padrao', 'responsavel_id',
      'status', 'mensagem_confirmacao', 'permite_cancelamento',
      'horas_antecedencia_cancelamento', 'criado_em', 'atualizado_em'
    ],
    HORARIOS: [
      'id_horario', 'id_evento', 'hora_inicio', 'hora_fim',
      'capacidade', 'dias_aplicaveis', 'ativo'
    ],
    BLOQUEIOS: [
      'id_bloqueio', 'id_evento', 'data', 'hora_inicio', 'hora_fim',
      'motivo', 'criado_por', 'criado_em'
    ],
    AGENDAMENTOS: [
      'id_agendamento', 'protocolo', 'id_evento', 'id_lead',
      'data_agendamento', 'hora_inicio', 'hora_fim', 'status',
      'motivo_cancelamento', 'cancelado_em', 'criado_em'
    ],
    LEADS: [
      'id_lead', 'nome', 'whatsapp', 'email', 'empresa', 'cargo',
      'origem_primeiro_evento', 'total_agendamentos', 'data_ultimo_agendamento',
      'responsavel_id', 'observacoes', 'criado_em', 'atualizado_em'
    ],
    CAMPOS_FORMULARIO: [
      'id_campo', 'id_evento', 'nome_campo', 'label', 'tipo',
      'obrigatorio', 'placeholder', 'opcoes', 'ordem', 'ativo'
    ],
    RESPOSTAS: [
      'id_resposta', 'id_agendamento', 'id_lead', 'id_campo',
      'valor', 'criado_em'
    ],
    CRM: [
      'id_oportunidade', 'id_lead', 'id_agendamento_origem', 'titulo',
      'estagio', 'sub_status', 'valor_estimado', 'valor_fechado', 'responsavel_id',
      'data_proximo_followup', 'motivo_perda', 'data_fechamento',
      'ordem_coluna', 'criado_em', 'atualizado_em'
    ],
    HISTORICO_CRM: [
      'id_historico', 'id_oportunidade', 'tipo', 'estagio_anterior',
      'estagio_novo', 'descricao', 'usuario_id', 'criado_em'
    ],
    TAREFAS: [
      'id_tarefa', 'id_oportunidade', 'id_lead', 'titulo', 'descricao',
      'data_vencimento', 'concluida', 'responsavel_id', 'criada_em', 'concluida_em'
    ],
    LOGS: [
      'id_log', 'nivel', 'origem', 'acao', 'detalhes', 'ip_ou_user_agent', 'timestamp'
    ]
  };

  for (var sheetName in schemas) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    // Configurar cabeçalhos se vazia
    if (sheet.getLastRow() === 0) {
      var headers = schemas[sheetName];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // Estilização corporativa (Fundo Grafite Escuro, Texto Branco, Negrito)
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#1E2022');
      headerRange.setFontColor('#FFFFFF');
      headerRange.setFontWeight('bold');
      headerRange.setHorizontalAlignment('center');
      
      // Congelar Linha 1
      sheet.setFrozenRows(1);
    }
  }

  // Preencher dados iniciais de configuração se vazio
  var configSheet = ss.getSheetByName('CONFIG');
  if (configSheet.getLastRow() <= 1) {
    var now = new Date().toISOString();
    configSheet.appendRow(['EMPRESA_NOME', 'Minha Empresa de Atendimento', 'Razão Social / Nome Fantasia', now]);
    configSheet.appendRow(['FUSO_HORARIO', 'America/Sao_Paulo', 'Fuso horário oficial', now]);
    configSheet.appendRow(['WHATSAPP_CONTATO', '5511999998888', 'WhatsApp de suporte', now]);
    configSheet.appendRow(['TERMOS_LGPD', 'Seus dados serão utilizados exclusivamente para contato e realização do atendimento.', 'Texto de consentimento LGPD', now]);
  }

  // Preencher usuário administrador padrão
  var userSheet = ss.getSheetByName('USUARIOS');
  if (userSheet.getLastRow() <= 1) {
    var now = new Date().toISOString();
    userSheet.appendRow(['USR-001', 'Administrador do Sistema', 'admin@empresa.com.br', 'ADMIN', true, now]);
  }

  SpreadsheetApp.getUi().alert('Sucesso! As 13 abas do Sistema de Agendamento foram criadas e formatadas.');
}
