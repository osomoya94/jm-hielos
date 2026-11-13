import { ConfigModule } from '@nestjs/config';

// AppModule se importa después de este archivo: no se lee .env ni se usa la clave real.
const forRoot = ConfigModule.forRoot.bind(
  ConfigModule,
) as typeof ConfigModule.forRoot;

jest.spyOn(ConfigModule, 'forRoot').mockImplementation((options) =>
  forRoot({
    ...options,
    ignoreEnvFile: true,
    ignoreEnvVars: true,
    skipProcessEnv: true,
    load: [() => ({ JWT_SECRET: 'clave-exclusiva-para-pruebas' })],
  }),
);
