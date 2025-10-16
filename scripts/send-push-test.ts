import fetch from 'cross-fetch';

type PushTicket = { id?: string; status?: string; message?: string; details?: any };

async function wait(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function main() {
  const token = process.argv[2];
  if (!token) {
    console.error('Uso: ts-node scripts/send-push-test.ts <ExpoPushToken>');
    process.exit(1);
  }

  const message = {
    to: token,
    sound: 'default',
    title: '🚀 Push de prueba',
    body: 'Si ves esto, el push remoto funciona (FCM).',
    data: { type: 'test', ts: Date.now() },
    // Sugerido para Android 8+: usa un canal existente
    channelId: 'default',
    priority: 'high',
    ttl: 60,
  };

  const sendRes = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });
  const sendJson = await sendRes.json();
  console.log('Ticket respuesta:');
  console.log(JSON.stringify(sendJson, null, 2));

  // Normalizar ticket id (data puede ser objeto o array)
  let ticketIds: string[] = [];
  if (Array.isArray(sendJson?.data)) {
    ticketIds = (sendJson.data as PushTicket[]).map((t) => t.id!).filter(Boolean);
  } else if (sendJson?.data?.id) {
    ticketIds = [sendJson.data.id];
  }

  if (ticketIds.length === 0) {
    console.warn('No hay ticketId. Puede que la solicitud haya fallado.');
    return;
  }

  // Espera breve y consulta receipts para diagnóstico
  await wait(3000);
  const receiptsRes = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: ticketIds }),
  });
  const receiptsJson = await receiptsRes.json();
  console.log('Receipts:');
  console.log(JSON.stringify(receiptsJson, null, 2));

  // Mensaje útil según error
  const receipts = receiptsJson?.data || {};
  for (const id of ticketIds) {
    const r = receipts[id];
    if (!r) continue;
    if (r.status === 'ok') {
      console.log(`✅ Entregado (ticket ${id})`);
    } else if (r.status === 'error') {
      console.log(`❌ Error (ticket ${id}): ${r.message || r.details?.error}`);
      if (r.details?.error === 'DeviceNotRegistered') {
        console.log('El token no es válido o pertenece a otra instalación. Abre la app, copia el token actual y reintenta.');
      }
      if (r.details?.error === 'MessageTooBig') {
        console.log('Payload demasiado grande. Reduce el contenido.');
      }
      if (r.details?.error === 'InvalidCredentials') {
        console.log('Credenciales push inválidas. Revisa google-services.json / FCM en Android.');
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
