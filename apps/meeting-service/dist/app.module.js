"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("@nestjs/typeorm");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const meeting_module_1 = require("./domain/meeting/meeting.module");
const prompt_module_1 = require("./domain/prompt/prompt.module");
const result_module_1 = require("./domain/result/result.module");
const user_settings_module_1 = require("./domain/user-settings/user-settings.module");
const document_output_module_1 = require("./domain/document-output/document-output.module");
const auth_module_1 = require("./shared/auth/auth.module");
const aws_module_1 = require("./shared/aws/aws.module");
const crypto_module_1 = require("./shared/crypto/crypto.module");
const env_validation_1 = require("./shared/config/env.validation");
const typeorm_options_factory_1 = require("./shared/config/typeorm-options.factory");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
                validate: env_validation_1.validateEnv,
            }),
            event_emitter_1.EventEmitterModule.forRoot(),
            typeorm_1.TypeOrmModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (configService) => {
                    return (0, typeorm_options_factory_1.buildTypeOrmModuleOptions)({
                        NODE_ENV: configService.get('NODE_ENV', { infer: true }),
                        DB_ENGINE: configService.get('DB_ENGINE', { infer: true }),
                        DB_MIGRATIONS_RUN: configService.get('DB_MIGRATIONS_RUN', { infer: true }),
                        DB_PATH: configService.get('DB_PATH', { infer: true }),
                        DB_HOST: configService.get('DB_HOST', { infer: true }),
                        DB_PORT: configService.get('DB_PORT', { infer: true }),
                        DB_NAME: configService.get('DB_NAME', { infer: true }),
                        DB_USER: configService.get('DB_USER', { infer: true }),
                        DB_PASSWORD: configService.get('DB_PASSWORD', { infer: true }),
                        DB_IAM_AUTH: configService.get('DB_IAM_AUTH', { infer: true }),
                        AWS_REGION: configService.get('AWS_REGION', { infer: true }),
                        DB_SSL: configService.get('DB_SSL', { infer: true }),
                        DB_SSL_REJECT_UNAUTHORIZED: configService.get('DB_SSL_REJECT_UNAUTHORIZED', { infer: true }),
                        DB_POOL_MAX: configService.get('DB_POOL_MAX', { infer: true }),
                        DB_CONNECTION_TIMEOUT_MS: configService.get('DB_CONNECTION_TIMEOUT_MS', { infer: true }),
                        DB_IDLE_TIMEOUT_MS: configService.get('DB_IDLE_TIMEOUT_MS', { infer: true }),
                        DB_STATEMENT_TIMEOUT_MS: configService.get('DB_STATEMENT_TIMEOUT_MS', { infer: true }),
                    });
                },
            }),
            aws_module_1.AwsModule,
            crypto_module_1.CryptoModule,
            auth_module_1.AuthModule,
            prompt_module_1.PromptModule,
            user_settings_module_1.UserSettingsModule,
            meeting_module_1.MeetingModule,
            result_module_1.ResultModule,
            document_output_module_1.DocumentOutputModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map