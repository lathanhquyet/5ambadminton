import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Database as DatabaseType } from 'better-sqlite3';
import { defaultDb } from '../database/db';
import { AuthRequest } from '../middlewares/authMiddleware';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_badminton_fund_jwt_key_2026';

export const loginHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Vui lòng nhập đầy đủ username và password.'
        }
      });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Tên đăng nhập hoặc mật khẩu không chính xác.'
        }
      });
    }

    const isValidPassword = bcrypt.compareSync(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Tên đăng nhập hoặc mật khẩu không chính xác.'
        }
      });
    }

    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      member_id: user.member_id
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    return res.status(200).json({
      success: true,
      data: {
        access_token: token,
        user: payload
      },
      message: 'Đăng nhập thành công.'
    });
  };
};

export const getMeHandler = (req: AuthRequest, res: Response) => {
  return res.status(200).json({
    success: true,
    data: {
      user: req.user
    }
  });
};

export const getAdminProfileHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    try {
      const userId = req.user?.id;
      const user = db.prepare('SELECT id, username, role, member_id FROM users WHERE id = ?').get(userId) as any;

      if (!user) {
        return res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'Không tìm thấy thông tin tài khoản.' }
        });
      }

      let memberInfo: any = {};
      if (user.member_id) {
        memberInfo = db.prepare('SELECT full_name, phone, email FROM members WHERE id = ?').get(user.member_id) as any || {};
      }

      return res.status(200).json({
        success: true,
        data: {
          id: user.id,
          username: user.username,
          role: user.role,
          fullName: memberInfo.full_name || 'Ban Quản Trị 5AM',
          email: memberInfo.email || 'admin@5ambadminton.com',
          phone: memberInfo.phone || '0901234567'
        }
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: err.message || 'Lỗi khi tải thông tin hồ sơ.' }
      });
    }
  };
};

export const updateAdminProfileHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    try {
      const userId = req.user?.id;
      const { fullName, email, phone } = req.body;

      const user = db.prepare('SELECT id, username, role, member_id FROM users WHERE id = ?').get(userId) as any;
      if (!user) {
        return res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'Không tìm thấy tài khoản.' }
        });
      }

      if (user.member_id) {
        db.prepare('UPDATE members SET full_name = ?, email = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(fullName || 'Ban Quản Trị 5AM', email || '', phone || '', user.member_id);
      }

      return res.status(200).json({
        success: true,
        data: {
          id: user.id,
          username: user.username,
          role: user.role, // Role cannot be changed from this GUI
          fullName: fullName || 'Ban Quản Trị 5AM',
          email: email || '',
          phone: phone || ''
        },
        message: 'Cập nhật thông tin hồ sơ thành công.'
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.message || 'Lỗi khi cập nhật hồ sơ.' }
      });
    }
  };
};

export const changePasswordHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    try {
      const userId = req.user?.id;
      const { currentPassword, newPassword, confirmPassword } = req.body;

      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Vui lòng điền đầy đủ mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu.' }
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          error: { code: 'PASSWORD_MISMATCH', message: 'Mật khẩu mới và xác nhận mật khẩu không khớp.' }
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          error: { code: 'PASSWORD_TOO_SHORT', message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' }
        });
      }

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      if (!user) {
        return res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'Không tìm thấy tài khoản.' }
        });
      }

      const isValidPassword = bcrypt.compareSync(currentPassword, user.password_hash);
      if (!isValidPassword) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_CURRENT_PASSWORD', message: 'Mật khẩu hiện tại không chính xác.' }
        });
      }

      const newHash = bcrypt.hashSync(newPassword, 10);
      db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, userId);

      return res.status(200).json({
        success: true,
        message: 'Đổi mật khẩu thành công.'
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: err.message || 'Lỗi khi đổi mật khẩu.' }
      });
    }
  };
};
