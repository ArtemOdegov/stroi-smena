import { Injectable, Logger } from '@nestjs/common';

/**
 * Заглушка под FCM/APNs: подключите firebase-admin / apn и вызовите из ChatGateway.
 */
@Injectable()
export class PushService {
  private readonly log = new Logger(PushService.name);

  notifyUser(_userId: string, _title: string, _body: string, _data?: Record<string, string>) {
    this.log.debug('Push stub: would notify user');
  }
}
