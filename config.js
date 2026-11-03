/* CONFIGURAÇÕES EDITÁVEIS DA IGREJA — nenhuma informação privada deve ser inserida aqui. */
window.IGREJA_CONFIG = {
  name: "Igreja no Jardim Leal",
  subtitle: "OBRA DA RESTAURAÇÃO",
  contact: "WhatsApp: (21) 99134-6305",
  phone: "+5521991346305",
  address: "R. Castro Rebelo, 835 - Vila Leopoldina (Jardim Leal), Duque de Caxias - RJ, CEP 25036-110",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=R.%20Castro%20Rebelo%2C%20835%20-%20Vila%20Leopoldina%20(Jardim%20Leal)%2C%20Duque%20de%20Caxias%20-%20RJ%2C%20CEP%2025036-110",
  weeklyServices: [{"day":"Segunda-feira","meetings":["Sem atividades regulares"],"closed":true},{"day":"Terça-feira","meetings":["19h30 às 21h00 — Culto da Palavra"],"closed":false},{"day":"Quarta-feira","meetings":["19h00 às 21h00 — Culto público"],"closed":false},{"day":"Quinta-feira","meetings":["Sem atividades regulares"],"closed":true},{"day":"Sexta-feira","meetings":["Sem atividades regulares"],"closed":true},{"day":"Sábado","meetings":["06h00 às 07h30 — Oração do monte","10h30 às 12h00 — Consagração","16h30 às 18h00 — Escola bíblica"],"closed":false},{"day":"Domingo","meetings":["18h20 às 21h00 — Culto público"],"closed":false}],
  youtube: "https://www.youtube.com/@igrejanojardimlealobradare8130",
  youtubeChannelId: "", // Opcional: ID UC... oficial. O GitHub Action também tenta resolver pelo @handle.
  pix: {
    key: "igrejanojardimleal@gmail.com",
    beneficiary: "GILMAR CALEGÁRIO MURRO", // Titular informado pela igreja; confirme no aplicativo antes de transferir
    city: "", // Cidade do titular ainda pendente para QR Code BR Code
    bank: "Nubank"
  },
  supabase: {
    url: "", // Ex.: https://seu-projeto.supabase.co
    anonKey: "" // Somente chave ANON/PUBLISHABLE; JAMAIS inserir service_role/secret
  }
};