import UserModel from "../models/user.sql";
import { NotFoundException } from "../utils/app-error";
import { UpdateUserType } from "../validators/user.validator";

export const findByIdUserService = async (userId: string) => {
  const user = await UserModel.findById(userId);
  return user?.omitPassword();
};

export const updateUserService = async (
  userId: string,
  body: UpdateUserType,
  profilePic?: Express.Multer.File
) => {
  const user = await UserModel.findById(userId);
  if (!user) throw new NotFoundException("User not found");

  const updates: any = {
    name: body.name,
  };

  if (profilePic) {
    updates.profilePicture = profilePic.path;
  }

  const updatedUser = await UserModel.updateById(userId, updates);
  if (!updatedUser) throw new NotFoundException("Failed to update user");

  return updatedUser.omitPassword();
};
