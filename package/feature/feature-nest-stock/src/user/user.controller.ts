import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { Request, Response } from 'shared~type-stock';
import { HttpService } from '@nestjs/axios';
import { UserService } from './user.service';
import { StockUser } from './user.schema';
import { UserRepository } from './user.repository';

@Controller('/stock/user')
export class UserController {
  constructor(
    private readonly httpService: HttpService,
    private readonly userService: UserService,
    private readonly userRepository: UserRepository,
  ) {}

  @Get()
  async getUsers(@Query('stockId') stockId: string): Promise<Response.GetStockUser[]> {
    const users = await this.userService.getUserList(stockId);
    return users.map((user) => this.userService.transStockUserToDto(user));
  }

  @Post()
  setUser(@Body() body: StockUser): Promise<boolean> {
    return this.userService.setUser(body);
  }

  @Post('/register')
  async registerUser(@Body() body: StockUser): Promise<Response.GetCreateUser> {
    return this.httpService.axiosRef
      .post<Response.GetCreateUser>('https://api.socialdev.club/queue/stock/user/register', body)
      .then((res) => {
        return res.data;
      })
      .catch(async (error) => {
        console.error(error);
        await this.userRepository.create(body);
        return { messageId: 'direct' };
      });
  }

  @Post('/align-index')
  async alignIndex(@Query('stockId') stockId: string): Promise<void> {
    return this.userService.alignIndex(stockId);
  }

  @Post('/introduce')
  async setIntroduce(@Body() body: Request.PostIntroduce): Promise<Response.SetIntroduce> {
    return this.userService.setIntroduce(body.stockId, body.userId, body.introduction);
  }

  @Post('loan')
  async startLoan(@Body() body: Request.PostLoan): Promise<Response.Common> {
    return this.userService.startLoan(body.stockId, body.userId);
  }

  @Post('loan/settle')
  async settleLoan(@Body() body: Request.PostSettleLoan): Promise<Response.Common> {
    return this.userService.settleLoan(body.stockId, body.userId);
  }

  @Delete()
  async removeUser(@Body() body: Request.RemoveStockUser): Promise<{ result: boolean }> {
    return { result: !!(await this.userService.removeUser(body.stockId, body.userId)) };
  }

  @Delete('/all')
  async removeAllUser(@Query('stockId') stockId: string): Promise<{ result: boolean }> {
    return { result: !!(await this.userService.removeAllUser(stockId)) };
  }
}
