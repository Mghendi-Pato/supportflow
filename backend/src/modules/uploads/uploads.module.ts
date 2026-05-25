import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [
    MulterModule.register({ dest: '/tmp' }), // Fallback — controller uses memoryStorage()
  ],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService], // Exported so TicketsModule can use it if needed later
})
export class UploadsModule {}
