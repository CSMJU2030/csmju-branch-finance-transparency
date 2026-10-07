import { Module } from '@nestjs/common';
import { CoreHubReferenceController } from './core-hub-reference.controller';
import { PeopleService } from './people.service';
import { ReferenceDataEventsLogger } from './reference-data-events.logger';
import { ReferenceDataService } from './reference-data.service';

/**
 * ข้อมูลกลางจาก Core Hub — import module นี้ใน module ที่ต้องใช้
 * แล้ว inject ReferenceDataService (ข้อมูลอ้างอิง cache ได้) หรือ PeopleService
 * (ข้อมูลบุคคล ห้าม cache) · ต้องมี ConfigModule แบบ global อยู่แล้ว
 */
@Module({
  controllers: [CoreHubReferenceController],
  providers: [ReferenceDataEventsLogger, ReferenceDataService, PeopleService],
  exports: [ReferenceDataService, PeopleService],
})
export class CoreHubModule {}
