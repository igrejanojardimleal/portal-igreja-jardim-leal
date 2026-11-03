/* CONFIGURAÇÕES EDITÁVEIS DA IGREJA — nenhuma informação privada deve ser inserida aqui. */
window.IGREJA_CONFIG = {
  name: "Igreja no Jardim Leal",
  subtitle: "OBRA DA RESTAURAÇÃO",
  contact: "WhatsApp: (21) 99134-6305",
  phone: "+5521991346305",
  email: "igrejanojardimleal@gmail.com",
  address: "Rua João Clementino, 831 — Jardim Leal, Duque de Caxias - RJ",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Rua%20Jo%C3%A3o%20Clementino%20831%2C%20Jardim%20Leal%2C%20Duque%20de%20Caxias%2C%20RJ",
  weeklyServices: [{"day":"Segunda-feira","meetings":["Fechado — sem cultos ou reuniões regulares"],"closed":true},{"day":"Terça-feira","meetings":["19h30 às 21h00 — Culto da Palavra"],"closed":false},{"day":"Quarta-feira","meetings":["19h00 às 21h00 — Culto público"],"closed":false},{"day":"Quinta-feira","meetings":["Fechado — sem cultos ou reuniões regulares"],"closed":true},{"day":"Sexta-feira","meetings":["Fechado — sem cultos ou reuniões regulares"],"closed":true},{"day":"Sábado","meetings":["06h00 às 07h30 — Oração do monte","10h30 às 12h00 — Consagração","16h30 às 18h00 — Escola bíblica"],"closed":false},{"day":"Domingo","meetings":["18h20 às 21h00 — Culto público"],"closed":false}],
  youtube: "https://www.youtube.com/@igrejanojardimlealobradare8130",
  youtubeChannelId: "", // Opcional: ID UC... oficial. O GitHub Action também tenta resolver pelo @handle.
  pix: {
    key: "igrejanojardimleal@gmail.com",
    beneficiary: "GILMAR CALEGÁRIO MURRO", // Titular informado pela igreja; confirme no aplicativo antes de transferir
    city: "", // Cidade do titular ainda pendente para QR Code BR Code
    bank: "Nubank"
  },
  supabase: {
    url: "https://tzexkzhygvmtbggjglxg.supabase.co", // URL pública do projeto Supabase da igreja
    anonKey: "sb_publishable_MxFRYFKRQQ7covPWwqJtbg_qSg6m8A7" // Somente chave ANON/PUBLISHABLE; JAMAIS inserir service_role/secret
  }
};
