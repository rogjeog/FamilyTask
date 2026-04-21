import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { FamiliesService } from './families.service';
import { CreateFamilyDto } from './dto/create-family.dto';
import { JoinFamilyDto } from './dto/join-family.dto';
import {
  CurrentUser,
  JwtUser,
} from '../auth/decorators/current-user.decorator';

@Controller('families')
export class FamiliesController {
  constructor(private readonly familiesService: FamiliesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createFamily(@Body() dto: CreateFamilyDto, @CurrentUser() user: JwtUser) {
    return this.familiesService.createFamily(user.userId, dto);
  }

  @Post('join')
  joinFamily(@Body() dto: JoinFamilyDto, @CurrentUser() user: JwtUser) {
    return this.familiesService.joinFamily(user.userId, dto);
  }

  @Get('me')
  getMyFamily(@CurrentUser() user: JwtUser) {
    return this.familiesService.getMyFamily(user.userId);
  }

  @Post(':id/invite')
  regenerateInvite(@Param('id') familyId: string, @CurrentUser() user: JwtUser) {
    return this.familiesService.regenerateInviteCode(user.userId, familyId);
  }
}
