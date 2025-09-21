// Reutilizamos EXACTAMENTE la misma pantalla de feed por evento,
// pero alojada dentro de la pila de "events" para no tocar la pila de "feed".
export { default } from '../../feed/[eventId]';
