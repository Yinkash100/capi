import { ApiProperty } from '@nestjs/swagger';
import { Group } from '@prisma/client';

export class GroupResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string | null;

  @ApiProperty()
  createdAt: Date;

  constructor(group: Group) {
    this.id = group.id;
    this.name = group.name;
    this.description = group.description;
    this.createdAt = group.createdAt;
  }
}