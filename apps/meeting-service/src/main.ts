import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

async function bootstrap() {
  // REST API(HTTP)가 아닌 gRPC 마이크로서비스로 구동
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.GRPC,
    options: {
      package: 'meeting',
      // 아까 작성한 proto 파일의 경로를 지정
      protoPath: join(__dirname, '../../../packages/proto/meeting.proto'),
      // gRPC 서버가 수신 대기할 포트
      url: '0.0.0.0:50051',
    },
  });
  await app.listen();
}
bootstrap();
