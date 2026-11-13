import { IsDateString, IsOptional, IsUUID, Matches } from 'class-validator';

export class ConsultarCashFlowDto {
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'desde debe tener formato YYYY-MM-DD',
  })
  desde!: string;

  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'hasta debe tener formato YYYY-MM-DD',
  })
  hasta!: string;

  @IsOptional()
  @IsUUID()
  cuentaId?: string;
}
