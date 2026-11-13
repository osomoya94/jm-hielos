import { jest } from '@jest/globals';
import { ConfigModule } from '@nestjs/config';

// Firma exclusiva de QA: no se carga el secreto de desarrollo.
const configurar = ConfigModule.forRoot.bind(
  ConfigModule,
) as typeof ConfigModule.forRoot;
jest.spyOn(ConfigModule, 'forRoot').mockImplementation((opciones) =>
  configurar({
    ...opciones,
    ignoreEnvFile: true,
    ignoreEnvVars: true,
    skipProcessEnv: true,
    load: [() => ({ JWT_SECRET: 'firma-exclusiva-del-entorno-qa' })],
  }),
);
