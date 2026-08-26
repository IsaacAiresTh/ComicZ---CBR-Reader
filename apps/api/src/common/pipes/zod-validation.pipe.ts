import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import type { z, ZodTypeAny } from 'zod';

/**
 * Valida body/query/params com um schema Zod compartilhado com o frontend.
 * Uso: @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput
 *
 * Generico sobre o schema (e nao sobre o tipo de saida) para aceitar schemas
 * com `default()` e `coerce`, onde entrada e saida tem tipos diferentes.
 */
@Injectable()
export class ZodValidationPipe<S extends ZodTypeAny>
  implements PipeTransform<unknown, z.output<S>>
{
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Dados invalidos',
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join('.') || '_',
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}
