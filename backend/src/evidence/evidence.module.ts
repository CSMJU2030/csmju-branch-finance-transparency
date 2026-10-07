import { Module } from '@nestjs/common';
import { CoreHubModule } from '../core-hub/core-hub.module';
import { ImagesModule } from '../images/images.module';
import { OfficersModule } from '../officers/officers.module';
import { EvidenceController, EvidenceFilesController } from './evidence.controller';
import { EvidenceService } from './evidence.service';

@Module({
  imports: [CoreHubModule, ImagesModule, OfficersModule],
  controllers: [EvidenceController, EvidenceFilesController],
  providers: [EvidenceService],
})
export class EvidenceModule {}
