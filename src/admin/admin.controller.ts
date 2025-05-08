import { 
    Controller, 
    Get, 
    Post, 
    Body, 
    Param, 
    UseGuards,
    Logger
  } from '@nestjs/common';
  import { AdminService } from './admin.service';
  import { CreateAdminDto } from './dto/create-admin.dto';
  import { AdminResponseDto } from './dto/admin-response.dto';
  import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
  import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
  import { ThrottlerGuard } from '@nestjs/throttler';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorators';
import { GetCurrentUser } from 'src/common/decorators/get-current-user.decorator';
  
  @ApiTags('admin')
  @Controller('admin')
  @UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  export class AdminController {
    private readonly logger = new Logger(AdminController.name);
    constructor(private readonly adminService: AdminService) {}
  
    @Post()
    @ApiOperation({ summary: 'Create a new admin' })
    @ApiResponse({ status: 201, description: 'Admin created successfully', type: AdminResponseDto })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 409, description: 'Email already exists' })
    async create(@Body() createAdminDto: CreateAdminDto, @GetCurrentUser('id') userId: string): Promise<AdminResponseDto> {
      this.logger.log('Create admin request received');
      return this.adminService.createAdmin(createAdminDto, userId);
    }
  
    @Get()
    @ApiOperation({ summary: 'Get all admins' })
    @ApiResponse({ status: 200, description: 'List of all admins', type: [AdminResponseDto] })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async findAll(): Promise<AdminResponseDto[]> {
      this.logger.log('Get all admins request received');
      return this.adminService.getAllUsers();
    }
  
    @Get(':id')
    @ApiOperation({ summary: 'Get admin by ID' })
    @ApiResponse({ status: 200, description: 'Admin details', type: AdminResponseDto })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Admin not found' })
    async findOne(@Param('id') id: string): Promise<AdminResponseDto> {
      this.logger.log(`Get admin by ID request received: ${id}`);
      return this.adminService.getUserById(id);
    }
  
    // @Put(':id')
    // @ApiOperation({ summary: 'Update an admin' })
    // @ApiResponse({ status: 200, description: 'Admin updated successfully', type: AdminResponseDto })
    // @ApiResponse({ status: 400, description: 'Bad request' })
    // @ApiResponse({ status: 401, description: 'Unauthorized' })
    // @ApiResponse({ status: 404, description: 'Admin not found' })
    // async update(@Param('id') id: string, @Body() updateAdminDto: UpdateAdminDto): Promise<AdminResponseDto> {
    //   this.logger.log(`Update admin request received: ${id}`);
    //   return this.adminService.updateUser(id, updateAdminDto);
    // }
    
    @Get('system-status')
    async getSystemStatus() {
      this.logger.log(`admin: Get system status`);
      return this.adminService.getSystemStats();
    }

  }