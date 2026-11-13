// Prisma 7 puede informar un conflicto al hacer COMMIT como error del adaptador,
// sin convertirlo a P2034. PostgreSQL igualmente revierte esa transacción.
export function esConflictoTransaccion(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if (
    'code' in error &&
    ['P2034', '40001', '40P01'].includes(String(error.code))
  )
    return true;
  const causa = 'cause' in error ? error.cause : undefined;
  if (!causa || typeof causa !== 'object') return false;
  return (
    ('kind' in causa && causa.kind === 'TransactionWriteConflict') ||
    ('originalCode' in causa &&
      ['40001', '40P01'].includes(String(causa.originalCode)))
  );
}
