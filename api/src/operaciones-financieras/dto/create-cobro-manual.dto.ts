import { CreatePagoManualDto } from './create-pago-manual.dto';

// Cobros y pagos manuales requieren los mismos campos y validaciones.
export class CreateCobroManualDto extends CreatePagoManualDto {}
