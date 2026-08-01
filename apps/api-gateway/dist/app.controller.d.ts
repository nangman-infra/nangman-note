import type { Request, Response } from 'express';
import { ProxyService } from './proxy/proxy.service';
export declare class AppController {
    private readonly proxyService;
    constructor(proxyService: ProxyService);
    health(): {
        status: string;
        service: string;
    };
    proxy(path: string, req: Request, res: Response): Promise<void>;
}
