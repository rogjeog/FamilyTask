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
  Put,
  Query,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { RejectTaskDto } from './dto/reject-task.dto';
import { CompleteTaskDto } from './dto/complete-task.dto';
import { DisputeTaskDto } from './dto/dispute-task.dto';
import { ReminderConfigDto } from './dto/reminder-config.dto';
import { ListTasksQuery } from './dto/list-tasks.query';
import {
  CurrentUser,
  JwtUser,
} from '../auth/decorators/current-user.decorator';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  listTasks(@Query() query: ListTasksQuery, @CurrentUser() user: JwtUser) {
    return this.tasksService.listTasks(user.userId, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createTask(@Body() dto: CreateTaskDto, @CurrentUser() user: JwtUser) {
    return this.tasksService.createTask(user.userId, dto);
  }

  @Get(':id')
  getTask(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.tasksService.getTask(user.userId, id);
  }

  @Patch(':id')
  updateTask(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tasksService.updateTask(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTask(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.tasksService.deleteTask(user.userId, id);
  }

  @Post(':id/accept')
  acceptTask(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.tasksService.acceptTask(user.userId, id);
  }

  @Post(':id/reject')
  rejectTask(
    @Param('id') id: string,
    @Body() dto: RejectTaskDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tasksService.rejectTask(user.userId, id, dto);
  }

  @Post(':id/complete')
  completeTask(
    @Param('id') id: string,
    @Body() dto: CompleteTaskDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tasksService.completeTask(user.userId, id, dto);
  }

  @Post(':id/validate')
  validateTask(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.tasksService.validateTask(user.userId, id);
  }

  @Post(':id/dispute')
  disputeTask(
    @Param('id') id: string,
    @Body() dto: DisputeTaskDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tasksService.disputeTask(user.userId, id, dto);
  }

  @Put(':id/reminders')
  setReminders(
    @Param('id') id: string,
    @Body() dto: ReminderConfigDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tasksService.setReminders(user.userId, id, dto);
  }
}
