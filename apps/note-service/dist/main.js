"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const secrets_loader_1 = require("./shared/aws/secrets-manager/secrets-loader");
const apply_global_app_config_1 = require("./bootstrap/apply-global-app-config");
async function bootstrap() {
    await (0, secrets_loader_1.loadSecrets)();
    const { AppModule } = await import('./app.module.js');
    const app = await core_1.NestFactory.create(AppModule, { bufferLogs: true });
    const configService = app.get((config_1.ConfigService));
    const port = configService.get('PORT', { infer: true }) ?? 3001;
    app.enableShutdownHooks();
    (0, apply_global_app_config_1.applyGlobalAppConfig)(app, configService);
    await app.listen(port);
}
void bootstrap();
//# sourceMappingURL=main.js.map