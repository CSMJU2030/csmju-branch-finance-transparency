import { Module } from '@nestjs/common';
import { CoreHubModule } from '../core-hub/core-hub.module';
import { OfficerScopeService } from './officer-scope.service';
import { OfficersController } from './officers.controller';
import { OfficersService } from './officers.service';

@Module({
  imports: [CoreHubModule],
  controllers: [OfficersController],
  providers: [OfficerScopeService, OfficersService],
  exports: [OfficerScopeService],
})
export class OfficersModule {}
