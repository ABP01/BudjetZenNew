import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDB } from "../config/dynamodb.config";
import ReportSettingModel, {
    ReportFrequencyEnum,
} from "../models/report-setting.dynamodb";
import UserModel from "../models/user.dynamodb";
import { NotFoundException, UnauthorizedException } from "../utils/app-error";
import { calulateNextReportDate } from "../utils/helper";
import { signJwtToken } from "../utils/jwt";
import {
    LoginSchemaType,
    RegisterSchemaType,
} from "../validators/auth.validator";

export const registerService = async (body: RegisterSchemaType) => {
  const { email } = body;

  try {
    // Check if user already exists
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) throw new UnauthorizedException("User already exists");

    // Create user and report setting in a transaction
    const userId = UserModel["dbService"].generateId();
    const nextReportDate = calulateNextReportDate();

    const userData = {
      name: body.name,
      email: body.email,
      password: body.password,
      profilePicture: null,
    };

    const reportSettingData = {
      userId: userId,
      frequency: ReportFrequencyEnum.MONTHLY,
      isEnabled: true,
      nextReportDate: nextReportDate,
      lastSentDate: null,
    };

    // Use DynamoDB transaction
    const command = new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: "users",
            Item: {
              PK: `USER#${userId}`,
              SK: `USER#${userId}`,
              GSI1PK: `EMAIL#${body.email.toLowerCase()}`,
              GSI1SK: `USER#${userId}`,
              name: body.name,
              email: body.email.toLowerCase(),
              password: body.password, // Will be hashed in UserModel.create
              profilePicture: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            ConditionExpression: "attribute_not_exists(PK)",
          },
        },
        {
          Put: {
            TableName: "report_settings",
            Item: {
              PK: `USER#${userId}`,
              SK: `REPORT_SETTING#${userId}`,
              userId: userId,
              frequency: ReportFrequencyEnum.MONTHLY,
              isEnabled: true,
              nextReportDate: nextReportDate,
              lastSentDate: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            ConditionExpression: "attribute_not_exists(PK)",
          },
        },
      ],
    });

    await dynamoDB.send(command);

    // Hash password after transaction
    const hashedPassword = await require("../utils/bcrypt").hashValue(body.password);
    await UserModel.updateById(userId, { password: hashedPassword });

    const newUser = await UserModel.findById(userId);
    return { user: newUser?.omitPassword() };
  } catch (error) {
    throw error;
  }
};

export const loginService = async (body: LoginSchemaType) => {
  const { email, password } = body;
  const user = await UserModel.findByEmail(email);
  if (!user) throw new NotFoundException("Email/password not found");

  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid)
    throw new UnauthorizedException("Invalid email/password");

  const { token, expiresAt } = signJwtToken({ userId: user.userId });

  const reportSetting = await ReportSettingModel.findByUserId(user.userId);

  return {
    user: user.omitPassword(),
    accessToken: token,
    expiresAt,
    reportSetting: reportSetting ? {
      id: reportSetting.userId,
      frequency: reportSetting.frequency,
      isEnabled: reportSetting.isEnabled,
    } : null,
  };
};
