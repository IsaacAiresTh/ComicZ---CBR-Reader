import { Inject, Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';

export interface Mensagem {
  para: string;
  assunto: string;
  texto: string;
  html: string;
}

/**
 * Envio de e-mail por SMTP generico. Sem SMTP configurado o servico nao
 * falha: registra a mensagem no log, que e como o link de redefinicao chega
 * a quem esta rodando o projeto em casa.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporte: Transporter | null;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    const smtp = config.smtp;
    this.transporte = smtp
      ? createTransport({
          host: smtp.host,
          port: smtp.port,
          secure: smtp.secure,
          auth: smtp.user ? { user: smtp.user, pass: smtp.pass ?? '' } : undefined,
        })
      : null;
  }

  get configurado(): boolean {
    return this.transporte !== null;
  }

  async enviar(mensagem: Mensagem): Promise<void> {
    if (!this.transporte) {
      this.logger.warn(
        `SMTP nao configurado; e-mail para ${mensagem.para} nao enviado.\n` +
          `  Assunto: ${mensagem.assunto}\n${mensagem.texto}`,
      );
      return;
    }
    await this.transporte.sendMail({
      from: this.config.mailFrom,
      to: mensagem.para,
      subject: mensagem.assunto,
      text: mensagem.texto,
      html: mensagem.html,
    });
  }
}
