import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // 🌟 API Gateway가 Meeting Service와 통신할 수 있도록 gRPC 클라이언트 등록
    ClientsModule.register([
      {
        name: 'MEETING_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'meeting',
          protoPath: join(__dirname, '../../../packages/proto/meeting.proto'),
          // K8s 환경에서는 meeting-service의 내부 DNS 이름 사용
          url: process.env.MEETING_SERVICE_URL || 'localhost:50051',
        },
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
