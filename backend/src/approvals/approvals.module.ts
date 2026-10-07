import { Module } from '@nestjs/common';
import { CoreHubModule } from '../core-hub/core-hub.module';
import { OfficersModule } from '../officers/officers.module';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';

@Module({
  imports: [CoreHubModule, OfficersModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
})
export class ApprovalsModule {}
