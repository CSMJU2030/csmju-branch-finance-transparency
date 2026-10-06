import { Module } from '@nestjs/common';
import { CoreHubModule } from '../core-hub/core-hub.module';
import { OfficersModule } from '../officers/officers.module';
import { YearAccountsController } from './year-accounts.controller';
import { YearAccountsService } from './year-accounts.service';

@Module({
  imports: [CoreHubModule, OfficersModule],
  controllers: [YearAccountsController],
  providers: [YearAccountsService],
})
export class YearAccountsModule {}
