import { Request, Response } from 'express';
import { Database as DatabaseType } from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { defaultDb } from '../database/db';
import { calculateExpectedDays } from '../services/businessFormula';

export const getMembersHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    const { type, status, year, month } = req.query;

    let query = 'SELECT * FROM members WHERE 1=1';
    const params: any[] = [];

    if (type) {
      query += ' AND member_type = ?';
      params.push(type);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const members = db.prepare(query).all(...params) as any[];

    // Calculate expected days if year & month parameters are provided
    const parsedYear = year ? parseInt(year as string, 10) : undefined;
    const parsedMonth = month ? parseInt(month as string, 10) : undefined;

    const formattedMembers = members.map((member) => {
      let expectedDays = 0;
      if (member.member_type === 'FIXED' && parsedYear && parsedMonth) {
        expectedDays = calculateExpectedDays(member.days_per_week, parsedYear, parsedMonth);
      }
      return {
        ...member,
        expected_days: expectedDays
      };
    });

    return res.status(200).json({
      success: true,
      data: formattedMembers
    });
  };
};

export const getMemberByIdHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    const { id } = req.params;

    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
    if (!member) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Không tìm thấy thông tin thành viên.'
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: member
    });
  };
};

export const createMemberHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    const { full_name, phone, email, member_type, status, days_per_week, joined_date, notes } = req.body;

    if (!full_name || !member_type || !joined_date) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Thiếu các thông tin bắt buộc: full_name, member_type, joined_date.'
        }
      });
    }

    if (!['FIXED', 'VISITOR'].includes(member_type)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_MEMBER_TYPE',
          message: 'member_type phải là FIXED hoặc VISITOR.'
        }
      });
    }

    const daysPerWeek = days_per_week !== undefined ? Number(days_per_week) : 0;
    if (isNaN(daysPerWeek) || daysPerWeek < 0 || daysPerWeek > 7 || !Number.isInteger(daysPerWeek)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DAYS_PER_WEEK',
          message: 'days_per_week phải là số nguyên từ 0 đến 7.'
        }
      });
    }

    const memberId = 'mem_' + Math.random().toString(36).substring(2, 10);
    const memberStatus = status || 'ACTIVE';

    db.prepare(`
      INSERT INTO members (id, full_name, phone, email, member_type, status, days_per_week, joined_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      memberId,
      full_name,
      phone || null,
      email || null,
      member_type,
      memberStatus,
      daysPerWeek,
      joined_date,
      notes || null
    );

    const createdMember = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);

    return res.status(201).json({
      success: true,
      data: createdMember,
      message: 'Thêm mới thành viên thành công.'
    });
  };
};

export const updateMemberHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    const { id } = req.params;
    const { full_name, phone, email, member_type, status, days_per_week, joined_date, notes } = req.body;

    const existingMember = db.prepare('SELECT * FROM members WHERE id = ?').get(id) as any;
    if (!existingMember) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Không tìm thấy thành viên để cập nhật.'
        }
      });
    }

    const updatedFullName = full_name !== undefined ? full_name : existingMember.full_name;
    const updatedPhone = phone !== undefined ? phone : existingMember.phone;
    const updatedEmail = email !== undefined ? email : existingMember.email;
    const updatedMemberType = member_type !== undefined ? member_type : existingMember.member_type;
    const updatedStatus = status !== undefined ? status : existingMember.status;
    const updatedDaysPerWeek = days_per_week !== undefined ? Number(days_per_week) : existingMember.days_per_week;
    const updatedJoinedDate = joined_date !== undefined ? joined_date : existingMember.joined_date;
    const updatedNotes = notes !== undefined ? notes : existingMember.notes;

    if (isNaN(updatedDaysPerWeek) || updatedDaysPerWeek < 0 || updatedDaysPerWeek > 7 || !Number.isInteger(updatedDaysPerWeek)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DAYS_PER_WEEK',
          message: 'days_per_week phải là số nguyên từ 0 đến 7.'
        }
      });
    }

    db.prepare(`
      UPDATE members
      SET full_name = ?, phone = ?, email = ?, member_type = ?, status = ?, days_per_week = ?, joined_date = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      updatedFullName,
      updatedPhone,
      updatedEmail,
      updatedMemberType,
      updatedStatus,
      updatedDaysPerWeek,
      updatedJoinedDate,
      updatedNotes,
      id
    );

    const updatedMember = db.prepare('SELECT * FROM members WHERE id = ?').get(id);

    return res.status(200).json({
      success: true,
      data: updatedMember,
      message: 'Cập nhật thành viên thành công.'
    });
  };
};

export const deleteMemberHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    const { id } = req.params;

    const existingMember = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
    if (!existingMember) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Không tìm thấy thành viên để xóa.'
        }
      });
    }

    // Soft delete: update status to INACTIVE
    db.prepare("UPDATE members SET status = 'INACTIVE', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);

    return res.status(200).json({
      success: true,
      message: 'Thành viên đã được chuyển trạng thái ngưng hoạt động (INACTIVE).'
    });
  };
};
