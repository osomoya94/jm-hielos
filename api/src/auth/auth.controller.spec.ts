import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ThrottlerGuard } from '@nestjs/throttler';

jest.mock('./auth.service', () => ({ AuthService: jest.fn() }));

describe('AuthController', () => {
  let controller: AuthController;
  const authService = { login: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    })
      // El límite se comprueba en E2E; aquí solo se prueba la delegación al servicio.
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('delega el login en AuthService', async () => {
    const respuesta = { token: 'token-de-prueba' };
    authService.login.mockResolvedValueOnce(respuesta);

    await expect(
      controller.login({ username: 'admin', password: 'ClavePrueba123' }),
    ).resolves.toEqual(respuesta);

    expect(authService.login).toHaveBeenCalledWith('admin', 'ClavePrueba123');
  });
});
