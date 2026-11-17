import { Module } from '@nestjs/common';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';
import { CityService } from './city.service';

@Module({
  controllers: [LocationController],
  providers: [LocationService, CityService],
  exports: [LocationService, CityService],
})
export class LocationModule {}

