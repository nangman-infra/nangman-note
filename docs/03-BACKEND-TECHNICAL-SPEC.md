# TransNote 백엔드 기술 명세서

> 백엔드 엔지니어 관점의 기술 설계 및 구현 가이드  
> 작성일: 2026.01.25  
> 버전: 1.0.0

---

## 📋 목차
1. [기술 스택](#1-기술-스택)
2. [아키텍처 설계](#2-아키텍처-설계)
3. [프로젝트 구조](#3-프로젝트-구조)
4. [개발 원칙](#4-개발-원칙)
5. [모듈 설계](#5-모듈-설계)
6. [데이터베이스 설계](#6-데이터베이스-설계)
7. [API 설계](#7-api-설계)
8. [보안 구현](#8-보안-구현)
9. [테스트 전략](#9-테스트-전략)
10. [개발 워크플로우](#10-개발-워크플로우)

---

## 1. 기술 스택

### 1.1 확정된 기술 스택

| 카테고리 | 기술 | 버전 | 선택 이유 |
|---------|-----|------|----------|
| **런타임** | Node.js | 24.x LTS | 최신 LTS, 보안 패치 |
| **프레임워크** | Nest.js | 10.x | TypeScript 네이티브, DI 지원 |
| **언어** | TypeScript | 5.x | 타입 안전성 |
| **패키지 매니저** | pnpm | 9.x | 빠른 속도, 디스크 효율 |
| **데이터베이스** | SQLite | 3.x | 개발용, 파일 기반 |
| **ORM** | TypeORM | 0.3.x | Nest.js 공식 지원 |
| **WebSocket** | @nestjs/websockets | 10.x | Nest.js 내장 |
| **환경변수** | @nestjs/config | 3.x | 타입 안전, 검증 지원 |
| **로깅** | Winston | 3.x | 유연한 설정 |
| **테스트** | Jest | 29.x | Nest.js 기본 |
| **E2E 테스트** | Supertest | 6.x | HTTP 테스트 |
| **린팅** | ESLint | 8.x | 코드 품질 |
| **포맷팅** | Prettier | 3.x | 일관된 스타일 |
| **Git Hooks** | Husky | 8.x | 자동 품질 체크 |

### 1.2 AWS SDK

```json
{
  "dependencies": {
    "@aws-sdk/client-transcribe-streaming": "^3.x",
    "@aws-sdk/client-bedrock-runtime": "^3.x",
    "@aws-sdk/credential-providers": "^3.x"
  }
}
```

### 1.3 프로덕션 전환 계획

| 항목 | 개발 | 프로덕션 |
|-----|------|----------|
| **DB** | SQLite (파일) | PostgreSQL 16.x |
| **암호화 키** | 환경변수 | AWS KMS |
| **로깅** | 콘솔 + 파일 | CloudWatch |
| **배포** | 로컬 | Docker + ECS/EKS |

---

## 2. 아키텍처 설계

### 2.1 아키텍처 패턴: DDD (Domain-Driven Design)

#### 선택 이유
- ✅ **독립성**: 각 도메인이 독립적으로 동작
- ✅ **원자성**: 도메인 단위로 완전한 기능 구현
- ✅ **높은 품질**: 명확한 책임 분리
- ✅ **확장성**: 도메인 추가/변경 용이

#### 계층 구조
```
Domain Layer (도메인 계층)
├─ domain/        : 엔티티, 값 객체, 도메인 이벤트
├─ application/   : 서비스, 유즈케이스, DTO
└─ infrastructure/: 리포지토리, 컨트롤러, 외부 연동

Shared Layer (공유 계층)
└─ shared/        : 공통 유틸, 설정, 필터, 인터셉터
```

### 2.2 통신 아키텍처

```
┌─────────────────────────────────────┐
│         Frontend (React)            │
└──────────┬──────────────────────────┘
           │
           │ HTTP + WebSocket
           │
┌──────────▼──────────────────────────┐
│       Nest.js (Port 3000)           │
│  ┌──────────────────────────────┐   │
│  │    REST API (/api/v1/*)      │   │
│  │    - Meeting CRUD            │   │
│  │    - Prompt CRUD             │   │
│  │    - Memo CRUD               │   │
│  │    - Result Retrieval        │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │  WebSocket (/ws/transcribe)  │   │
│  │    - 실시간 음성 스트리밍     │   │
│  │    - 실시간 전사 결과 전송    │   │
│  └──────────────────────────────┘   │
└──────────┬──────────────────────────┘
           │
     ┌─────┼─────┐
     │     │     │
┌────▼─┐ ┌─▼──┐ ┌▼────────┐
│SQLite│ │AWS │ │  AWS    │
│      │ │Tran│ │ Bedrock │
│      │ │scri│ │ (Claude)│
└──────┘ └────┘ └─────────┘
```

---

## 3. 프로젝트 구조

### 3.1 전체 디렉터리 구조

```
backend/
├── src/
│   ├── domain/                          # 도메인 계층
│   │   ├── meeting/                     # 회의 도메인
│   │   │   ├── domain/                  # 도메인 모델
│   │   │   │   ├── meeting.entity.ts
│   │   │   │   ├── meeting-status.enum.ts
│   │   │   │   └── interfaces/
│   │   │   ├── application/             # 애플리케이션 로직
│   │   │   │   ├── meeting.service.ts
│   │   │   │   ├── dto/
│   │   │   │   │   ├── create-meeting.dto.ts
│   │   │   │   │   ├── update-meeting.dto.ts
│   │   │   │   │   └── meeting-response.dto.ts
│   │   │   │   └── interfaces/
│   │   │   ├── infrastructure/          # 인프라 계층
│   │   │   │   ├── meeting.repository.ts
│   │   │   │   ├── meeting.controller.ts
│   │   │   │   └── persistence/
│   │   │   ├── meeting.module.ts
│   │   │   └── __tests__/               # 모듈별 테스트
│   │   │       ├── meeting.service.spec.ts
│   │   │       ├── meeting.repository.spec.ts
│   │   │       └── meeting.e2e-spec.ts
│   │   │
│   │   ├── prompt/                      # 프롬프트 도메인
│   │   │   ├── domain/
│   │   │   ├── application/
│   │   │   ├── infrastructure/
│   │   │   ├── prompt.module.ts
│   │   │   └── __tests__/
│   │   │
│   │   ├── transcription/               # 전사 도메인
│   │   │   ├── domain/
│   │   │   ├── application/
│   │   │   ├── infrastructure/
│   │   │   │   └── transcription.gateway.ts  # WebSocket
│   │   │   ├── transcription.module.ts
│   │   │   └── __tests__/
│   │   │
│   │   ├── memo/                        # 메모 도메인
│   │   │   ├── domain/
│   │   │   ├── application/
│   │   │   ├── infrastructure/
│   │   │   ├── memo.module.ts
│   │   │   └── __tests__/
│   │   │
│   │   └── result/                      # 결과 도메인
│   │       ├── domain/
│   │       ├── application/
│   │       ├── infrastructure/
│   │       ├── result.module.ts
│   │       └── __tests__/
│   │
│   ├── shared/                          # 공유 계층
│   │   ├── config/                      # 설정
│   │   │   ├── database.config.ts
│   │   │   ├── aws.config.ts
│   │   │   └── validation.schema.ts
│   │   │
│   │   ├── database/                    # 데이터베이스
│   │   │   ├── database.module.ts
│   │   │   └── base.repository.ts       # 공통 리포지토리
│   │   │
│   │   ├── encryption/                  # 암호화
│   │   │   ├── encryption.service.ts
│   │   │   └── encryption.module.ts
│   │   │
│   │   ├── aws/                         # AWS 서비스
│   │   │   ├── transcribe/
│   │   │   │   ├── transcribe.service.ts
│   │   │   │   └── transcribe.module.ts
│   │   │   └── bedrock/
│   │   │       ├── bedrock.service.ts
│   │   │       └── bedrock.module.ts
│   │   │
│   │   ├── filters/                     # 전역 필터
│   │   │   ├── http-exception.filter.ts
│   │   │   └── all-exceptions.filter.ts
│   │   │
│   │   ├── interceptors/                # 전역 인터셉터
│   │   │   ├── response.interceptor.ts
│   │   │   └── logging.interceptor.ts
│   │   │
│   │   ├── guards/                      # 가드
│   │   │   └── auth.guard.ts            # 추후 구현
│   │   │
│   │   ├── decorators/                  # 커스텀 데코레이터
│   │   │   └── current-user.decorator.ts
│   │   │
│   │   ├── pipes/                       # 파이프
│   │   │   └── validation.pipe.ts
│   │   │
│   │   ├── logger/                      # 로깅
│   │   │   ├── winston.config.ts
│   │   │   └── logger.module.ts
│   │   │
│   │   └── utils/                       # 유틸리티
│   │       ├── date.util.ts
│   │       └── id.generator.ts
│   │
│   ├── app.module.ts                    # 루트 모듈
│   └── main.ts                          # 엔트리 포인트
│
├── test/                                # E2E 테스트
│   ├── app.e2e-spec.ts
│   ├── meeting.e2e-spec.ts
│   └── jest-e2e.json
│
├── data/                                # 데이터 디렉터리
│   ├── dev.db                           # SQLite DB (gitignore)
│   └── .gitkeep
│
├── .env.example                         # 환경변수 예시
├── .env                                 # 환경변수 (gitignore)
├── .gitignore
├── .eslintrc.js
├── .prettierrc
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── tsconfig.build.json
├── nest-cli.json
└── README.md
```

### 3.2 각 도메인의 표준 구조

```typescript
// domain/meeting/
├── domain/                  # 도메인 모델
│   ├── meeting.entity.ts    // 엔티티 (TypeORM)
│   ├── meeting-status.enum.ts
│   └── interfaces/
│       └── meeting.interface.ts
│
├── application/             # 비즈니스 로직
│   ├── meeting.service.ts   // 서비스
│   ├── dto/                 // 데이터 전송 객체
│   │   ├── create-meeting.dto.ts
│   │   ├── update-meeting.dto.ts
│   │   └── meeting-response.dto.ts
│   └── interfaces/
│       └── meeting-service.interface.ts
│
├── infrastructure/          # 인프라 구현
│   ├── meeting.repository.ts    // 리포지토리
│   └── meeting.controller.ts    // 컨트롤러
│
├── meeting.module.ts        // Nest.js 모듈
└── __tests__/               # 테스트
    ├── meeting.service.spec.ts
    ├── meeting.repository.spec.ts
    └── meeting.e2e-spec.ts
```

---

## 4. 개발 원칙

### 4.1 핵심 원칙

#### 1. 독립성 (Independence)
**원칙**: 각 도메인 모듈은 독립적으로 동작해야 함

```typescript
// ✅ 좋은 예: 최소한의 의존성
@Module({
  imports: [TypeOrmModule.forFeature([Meeting])],
  providers: [MeetingService, MeetingRepository],
  exports: [MeetingService],
})
export class MeetingModule {}

// ❌ 나쁜 예: 순환 의존성
@Module({
  imports: [TranscriptionModule, MemoModule], // 과도한 의존
})
export class MeetingModule {}
```

#### 2. 원자성 (Atomicity)
**원칙**: 각 기능은 완전하게 동작하거나 전혀 동작하지 않아야 함

```typescript
// ✅ 좋은 예: 트랜잭션 보장
@Transaction()
async createMeeting(dto: CreateMeetingDto): Promise<Meeting> {
  const meeting = await this.meetingRepository.save(dto);
  await this.auditLog.log('MEETING_CREATED', meeting.id);
  return meeting;
}

// ❌ 나쁜 예: 부분 실패 가능
async createMeeting(dto: CreateMeetingDto): Promise<Meeting> {
  const meeting = await this.meetingRepository.save(dto);
  this.auditLog.log('MEETING_CREATED', meeting.id); // 실패 가능
  return meeting;
}
```

#### 3. 높은 품질 (High Quality)
**원칙**: 중복 없는 깔끔한 코드, SOLID 원칙 준수

```typescript
// ✅ 좋은 예: DRY, 재사용 가능
abstract class BaseRepository<T> {
  constructor(
    @InjectRepository(Entity)
    protected readonly repository: Repository<T>,
  ) {}

  async findById(id: string): Promise<T> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`${this.entityName} not found`);
    }
    return entity;
  }
}

@Injectable()
export class MeetingRepository extends BaseRepository<Meeting> {
  protected entityName = 'Meeting';
}

// ❌ 나쁜 예: 중복 코드
@Injectable()
export class MeetingRepository {
  async findById(id: string): Promise<Meeting> {
    const meeting = await this.repository.findOne({ where: { id } });
    if (!meeting) throw new NotFoundException('Meeting not found');
    return meeting;
  }
}

@Injectable()
export class PromptRepository {
  async findById(id: string): Promise<Prompt> {
    const prompt = await this.repository.findOne({ where: { id } });
    if (!prompt) throw new NotFoundException('Prompt not found');
    return prompt;
  }
}
```

### 4.2 SOLID 원칙 적용

#### S - Single Responsibility Principle
```typescript
// ✅ 단일 책임
class MeetingService {
  async createMeeting(dto: CreateMeetingDto) { /* 회의 생성 */ }
}

class EncryptionService {
  encrypt(data: string) { /* 암호화 */ }
}

// ❌ 책임 혼재
class MeetingService {
  async createMeeting(dto: CreateMeetingDto) {
    const encrypted = this.encrypt(dto.title); // 암호화 책임도 가짐
  }
}
```

#### O - Open/Closed Principle
```typescript
// ✅ 확장에 열려있고 수정에 닫혀있음
interface IPromptProvider {
  getPrompt(type: string): string;
}

class DefaultPromptProvider implements IPromptProvider {
  getPrompt(type: string): string { /* 기본 구현 */ }
}

class CustomPromptProvider implements IPromptProvider {
  getPrompt(type: string): string { /* 커스텀 구현 */ }
}
```

#### L - Liskov Substitution Principle
```typescript
// ✅ 서브타입은 기반 타입으로 대체 가능
abstract class BaseRepository<T> {
  abstract findById(id: string): Promise<T>;
}

class MeetingRepository extends BaseRepository<Meeting> {
  findById(id: string): Promise<Meeting> {
    // Meeting 타입 반환
  }
}
```

#### I - Interface Segregation Principle
```typescript
// ✅ 작은 인터페이스로 분리
interface IReadable<T> {
  findById(id: string): Promise<T>;
  findAll(): Promise<T[]>;
}

interface IWritable<T> {
  save(entity: T): Promise<T>;
  delete(id: string): Promise<void>;
}

// ❌ 거대한 인터페이스
interface IRepository<T> {
  findById(id: string): Promise<T>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<T>;
  delete(id: string): Promise<void>;
  bulkInsert(entities: T[]): Promise<T[]>;
  // ... 너무 많은 메서드
}
```

#### D - Dependency Inversion Principle
```typescript
// ✅ 추상화에 의존
class MeetingService {
  constructor(
    @Inject('IMeetingRepository')
    private readonly repository: IMeetingRepository,
  ) {}
}

// ❌ 구체 클래스에 의존
class MeetingService {
  constructor(
    private readonly repository: MeetingRepository, // 구체 클래스
  ) {}
}
```

---

## 5. 모듈 설계

### 5.1 Meeting 모듈 (예시)

#### 엔티티 (domain/meeting.entity.ts)
```typescript
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('meetings')
export class Meeting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  title?: string;

  @Column({ type: 'text', nullable: true })
  agenda?: string;

  @Column({ name: 'prompt_id' })
  promptId: string;

  @Column({ type: 'varchar', length: 20 })
  status: MeetingStatus;

  @Column({ name: 'started_at', type: 'datetime' })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'datetime', nullable: true })
  endedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

#### 서비스 (application/meeting.service.ts)
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { MeetingRepository } from '../infrastructure/meeting.repository';
import { CreateMeetingDto } from './dto/create-meeting.dto';

@Injectable()
export class MeetingService {
  constructor(
    private readonly meetingRepository: MeetingRepository,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(MeetingService.name);
  }

  async create(dto: CreateMeetingDto): Promise<Meeting> {
    this.logger.log(`Creating meeting: ${dto.title}`);
    
    const meeting = this.meetingRepository.create({
      ...dto,
      status: MeetingStatus.RECORDING,
      startedAt: new Date(),
    });

    return this.meetingRepository.save(meeting);
  }

  async findById(id: string): Promise<Meeting> {
    const meeting = await this.meetingRepository.findById(id);
    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${id} not found`);
    }
    return meeting;
  }

  async complete(id: string): Promise<Meeting> {
    const meeting = await this.findById(id);
    
    meeting.status = MeetingStatus.PROCESSING;
    meeting.endedAt = new Date();
    
    return this.meetingRepository.save(meeting);
  }
}
```

#### 컨트롤러 (infrastructure/meeting.controller.ts)
```typescript
import { Controller, Get, Post, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { MeetingService } from '../application/meeting.service';
import { CreateMeetingDto } from '../application/dto/create-meeting.dto';

@Controller('api/v1/meetings')
export class MeetingController {
  constructor(private readonly meetingService: MeetingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateMeetingDto) {
    return this.meetingService.create(dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.meetingService.findById(id);
  }

  @Post(':id/complete')
  async complete(@Param('id') id: string) {
    return this.meetingService.complete(id);
  }
}
```

### 5.2 모듈 간 통신

```typescript
// ✅ 좋은 예: 서비스 주입을 통한 통신
@Injectable()
export class ResultService {
  constructor(
    private readonly meetingService: MeetingService,
    private readonly transcriptionService: TranscriptionService,
    private readonly memoService: MemoService,
    private readonly bedrockService: BedrockService,
  ) {}

  async generate(meetingId: string): Promise<Result> {
    const meeting = await this.meetingService.findById(meetingId);
    const transcripts = await this.transcriptionService.findByMeetingId(meetingId);
    const memos = await this.memoService.findByMeetingId(meetingId);
    
    return this.bedrockService.generate(meeting, transcripts, memos);
  }
}
```

---

## 6. 데이터베이스 설계

### 6.1 엔티티 관계도 (ERD)

```
Meeting 1──────────N TranscriptSegment
   │                     
   │                     
   ├──────────N Memo
   │
   ├──────────1 MeetingResult
   │
   └──────────N Prompt (FK)

Prompt 1──────────N Meeting
   │
   └──────────1 User (FK, nullable)
```

### 6.2 Base Entity

```typescript
// shared/database/base.entity.ts
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

### 6.3 Base Repository

```typescript
// shared/database/base.repository.ts
export abstract class BaseRepository<T extends BaseEntity> {
  constructor(
    @InjectRepository(T)
    protected readonly repository: Repository<T>,
  ) {}

  async findById(id: string): Promise<T | null> {
    return this.repository.findOne({ where: { id } as any });
  }

  async findAll(): Promise<T[]> {
    return this.repository.find();
  }

  async save(entity: DeepPartial<T>): Promise<T> {
    const created = this.repository.create(entity);
    return this.repository.save(created);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
```

---

## 7. API 설계

### 7.1 응답 포맷

#### 성공 응답
```typescript
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "회의 제목",
    // ...
  }
}
```

#### 에러 응답
```typescript
{
  "success": false,
  "error": {
    "code": "MEETING_NOT_FOUND",
    "message": "회의를 찾을 수 없습니다",
    "statusCode": 404,
    "timestamp": "2026-01-25T00:00:00Z",
    "path": "/api/v1/meetings/123"
  }
}
```

### 7.2 Response Interceptor

```typescript
// shared/interceptors/response.interceptor.ts
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map(data => ({
        success: true,
        data,
      })),
    );
  }
}

interface Response<T> {
  success: boolean;
  data: T;
}
```

### 7.3 Exception Filter

```typescript
// shared/filters/http-exception.filter.ts
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    response.status(status).json({
      success: false,
      error: {
        code: exception.name,
        message: exception.message,
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    });
  }
}
```

---

## 8. 보안 구현

### 8.1 암호화 서비스

```typescript
// shared/encryption/encryption.service.ts
import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const keyHex = this.configService.get<string>('ENCRYPTION_KEY');
    this.key = Buffer.from(keyHex, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return JSON.stringify({
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    });
  }

  decrypt(ciphertext: string): string {
    const { encrypted, iv, authTag } = JSON.parse(ciphertext);

    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'hex'),
    );

    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
```

### 8.2 TypeORM 암호화 변환기

```typescript
// shared/encryption/encryption.transformer.ts
import { ValueTransformer } from 'typeorm';
import { EncryptionService } from './encryption.service';

export class EncryptionTransformer implements ValueTransformer {
  constructor(private readonly encryptionService: EncryptionService) {}

  to(value: string): string {
    return this.encryptionService.encrypt(value);
  }

  from(value: string): string {
    return this.encryptionService.decrypt(value);
  }
}

// 사용 예시
@Entity()
export class TranscriptSegment {
  @Column({
    type: 'text',
    transformer: new EncryptionTransformer(encryptionService),
  })
  text: string; // 자동 암호화/복호화
}
```

---

## 9. 테스트 전략

### 9.1 테스트 피라미드

```
        ┌──────────────┐
        │  E2E Tests   │  (10%)
        │   Supertest  │
        ├──────────────┤
        │ Integration  │  (30%)
        │    Tests     │
        ├──────────────┤
        │  Unit Tests  │  (60%)
        │     Jest     │
        └──────────────┘
```

### 9.2 단위 테스트 (Unit Tests)

```typescript
// domain/meeting/__tests__/meeting.service.spec.ts
describe('MeetingService', () => {
  let service: MeetingService;
  let repository: MockType<MeetingRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MeetingService,
        {
          provide: MeetingRepository,
          useFactory: mockRepository,
        },
      ],
    }).compile();

    service = module.get(MeetingService);
    repository = module.get(MeetingRepository);
  });

  describe('create', () => {
    it('should create a meeting', async () => {
      const dto: CreateMeetingDto = {
        title: 'Test Meeting',
        promptId: 'prompt-1',
      };

      repository.save.mockResolvedValue({ id: '123', ...dto });

      const result = await service.create(dto);

      expect(result).toHaveProperty('id');
      expect(result.title).toBe(dto.title);
      expect(repository.save).toHaveBeenCalledTimes(1);
    });

    it('should throw error if prompt not found', async () => {
      const dto: CreateMeetingDto = {
        title: 'Test',
        promptId: 'invalid',
      };

      repository.save.mockRejectedValue(new NotFoundException());

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });
  });
});
```

### 9.3 통합 테스트 (Integration Tests)

```typescript
// domain/meeting/__tests__/meeting.integration.spec.ts
describe('Meeting Integration', () => {
  let app: INestApplication;
  let meetingService: MeetingService;
  let connection: Connection;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Meeting, Prompt],
          synchronize: true,
        }),
        MeetingModule,
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    
    meetingService = module.get(MeetingService);
    connection = module.get(Connection);
  });

  it('should create and retrieve meeting', async () => {
    const created = await meetingService.create({
      title: 'Integration Test',
      promptId: 'default',
    });

    const retrieved = await meetingService.findById(created.id);

    expect(retrieved).toEqual(created);
  });

  afterAll(async () => {
    await connection.close();
    await app.close();
  });
});
```

### 9.4 E2E 테스트 (End-to-End Tests)

```typescript
// test/meeting.e2e-spec.ts
describe('Meeting E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  describe('/api/v1/meetings (POST)', () => {
    it('should create a meeting', () => {
      return request(app.getHttpServer())
        .post('/api/v1/meetings')
        .send({
          title: 'E2E Test Meeting',
          promptId: 'default',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('id');
        });
    });

    it('should return 400 for invalid input', () => {
      return request(app.getHttpServer())
        .post('/api/v1/meetings')
        .send({ title: '' }) // invalid
        .expect(400);
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
```

### 9.5 테스트 커버리지 목표

| 항목 | 목표 |
|-----|------|
| **전체 커버리지** | > 80% |
| **서비스 계층** | > 90% |
| **리포지토리 계층** | > 85% |
| **컨트롤러 계층** | > 80% |

---

## 10. 개발 워크플로우

### 10.1 기능 개발 순서 (예: Meeting 모듈)

```
1. DTO 작성
   └─ create-meeting.dto.ts
   └─ update-meeting.dto.ts

2. 엔티티 작성
   └─ meeting.entity.ts
   └─ meeting-status.enum.ts

3. 리포지토리 작성 + 테스트
   └─ meeting.repository.ts
   └─ meeting.repository.spec.ts

4. 서비스 작성 + 테스트
   └─ meeting.service.ts
   └─ meeting.service.spec.ts

5. 컨트롤러 작성 + E2E 테스트
   └─ meeting.controller.ts
   └─ meeting.e2e-spec.ts

6. 모듈 통합
   └─ meeting.module.ts

7. ✅ 기능 완성 (모든 테스트 통과)
```

### 10.2 Git 워크플로우

```bash
# 1. 기능 브랜치 생성
git checkout -b feature/meeting-module

# 2. 개발 진행
git add .
git commit -m "feat: implement meeting creation"

# 3. Husky가 자동으로 실행
# - lint-staged: ESLint + Prettier
# - pre-push: Jest 테스트

# 4. PR 생성 및 리뷰

# 5. 메인 브랜치 머지
git checkout main
git merge feature/meeting-module
```

### 10.3 커밋 메시지 컨벤션

```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 코드 포맷팅
refactor: 리팩토링
test: 테스트 추가/수정
chore: 빌드 설정 등

예시:
feat: implement meeting creation API
fix: resolve encryption key loading issue
docs: update API documentation
test: add unit tests for MeetingService
```

### 10.4 코드 리뷰 체크리스트

- [ ] **기능 요구사항 충족**
- [ ] **SOLID 원칙 준수**
- [ ] **중복 코드 없음**
- [ ] **적절한 에러 핸들링**
- [ ] **테스트 커버리지 충족**
- [ ] **타입 안전성 확보**
- [ ] **보안 취약점 없음**
- [ ] **성능 최적화**
- [ ] **문서화 완료**

### 10.5 배포 체크리스트

#### 개발 환경
- [ ] 환경변수 설정 (.env)
- [ ] SQLite 데이터베이스 파일 생성
- [ ] pnpm install
- [ ] npm run start:dev

#### 프로덕션 환경
- [ ] PostgreSQL 데이터베이스 설정
- [ ] AWS KMS 키 설정
- [ ] 환경변수 검증
- [ ] Docker 이미지 빌드
- [ ] E2E 테스트 통과
- [ ] 성능 테스트 통과
- [ ] 보안 스캔 통과

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|-----|------|----------|
| 1.0.0 | 2026-01-25 | 초안 작성 (기술 인터뷰 기반) |

---

**문서 끝**
