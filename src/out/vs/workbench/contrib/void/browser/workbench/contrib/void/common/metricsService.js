/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { localize2 } from '../../../../nls.js';
import { registerAction2, Action2 } from '../../../../platform/actions/common/actions.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
export const IMetricsService = createDecorator('metricsService');
// implemented by calling channel
export class MetricsService {
    _serviceBrand;
    metricsService;
    constructor(mainProcessService // (only usable on client side)
    ) {
        // creates an IPC proxy to use metricsMainService.ts
        this.metricsService = ProxyChannel.toService(mainProcessService.getChannel('void-channel-metrics'));
    }
    // call capture on the channel
    capture(...params) {
        this.metricsService.capture(...params);
    }
    setOptOut(...params) {
        this.metricsService.setOptOut(...params);
    }
    // anything transmitted over a channel must be async even if it looks like it doesn't have to be
    async getDebuggingProperties() {
        return this.metricsService.getDebuggingProperties();
    }
}
registerSingleton(IMetricsService, MetricsService, 0 /* InstantiationType.Eager */);
// debugging action
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'voidDebugInfo',
            f1: true,
            title: localize2('voidMetricsDebug', 'Void: Log Debug Info'),
        });
    }
    async run(accessor) {
        const metricsService = accessor.get(IMetricsService);
        const notifService = accessor.get(INotificationService);
        const debugProperties = await metricsService.getDebuggingProperties();
        console.log('Metrics:', debugProperties);
        notifService.info(`Void Debug info:\n${JSON.stringify(debugProperties, null, 2)}`);
    }
});
