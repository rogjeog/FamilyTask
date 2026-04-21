import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { FamiliesService } from './families.service';
import { CreateFamilyDto } from './dto/create-family.dto';
import { JoinFamilyDto } from './dto/join-family.dto';
import { RenameFamilyDto } from './dto/rename-family.dto';
import { ChangeMemberRoleDto } from './dto/change-member-role.dto';
import { DeleteFamilyDto } from './dto/delete-family.dto';
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

  @Patch('me')
  renameFamily(@Body() dto: RenameFamilyDto, @CurrentUser() user: JwtUser) {
    return this.familiesService.renameFamily(user.userId, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteFamily(@Body() dto: DeleteFamilyDto, @CurrentUser() user: JwtUser) {
    return this.familiesService.deleteFamily(user.userId, dto);
  }

  @Post('me/invite')
  regenerateInvite(@CurrentUser() user: JwtUser) {
    return this.familiesService.regenerateInviteCode(user.userId);
  }

  @Post('me/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  leaveFamily(@CurrentUser() user: JwtUser) {
    return this.familiesService.leaveFamily(user.userId);
  }

  @Delete('me/members/:userId')
  kickMember(
    @Param('userId') targetUserId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.familiesService.kickMember(user.userId, targetUserId);
  }

  @Patch('me/members/:userId')
  changeMemberRole(
    @Param('userId') targetUserId: string,
    @Body() dto: ChangeMemberRoleDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.familiesService.changeMemberRole(user.userId, targetUserId, dto);
  }
}
