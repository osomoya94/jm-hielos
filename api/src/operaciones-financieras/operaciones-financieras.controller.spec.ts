import { Test } from '@nestjs/testing';
import { OperacionesFinancierasController } from './operaciones-financieras.controller';
import { OperacionesFinancierasService } from './operaciones-financieras.service';

jest.mock('./operaciones-financieras.service', () => ({
  OperacionesFinancierasService: jest.fn(),
}));

describe('OperacionesFinancierasController', () => {
  it('should be defined', async () => {
    const module = await Test.createTestingModule({
      controllers: [OperacionesFinancierasController],
      providers: [{ provide: OperacionesFinancierasService, useValue: {} }],
    }).compile();
    expect(module.get(OperacionesFinancierasController)).toBeDefined();
  });
});
