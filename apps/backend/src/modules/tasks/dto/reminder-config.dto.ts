import { ArrayMaxSize, IsArray, IsInt, Max, Min } from 'class-validator';

export class ReminderConfigDto {
  @IsArray()
  @ArrayMaxSize(10)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(10080, { each: true })
  offsetsMinutes: number[];
}
