const argon2 = require('argon2');
const repository = require('../repositories/me.repository');

function makeError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isEmailConflict(error) {
  const number = error.number ?? error.original?.number ?? error.parent?.number;
  return number === 2627 || number === 2601 || error.name === 'SequelizeUniqueConstraintError';
}

async function updateProfile(user, body) {
  const userValues = {};
  const profileValues = {};
  if (Object.hasOwn(body, 'fullName')) {
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    if (!fullName || fullName.length > 150) throw makeError('Họ tên là bắt buộc (tối đa 150 ký tự)', 400);
    userValues.fullName = fullName;
  }
  if (Object.hasOwn(body, 'email')) {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) throw makeError('Email không hợp lệ', 400);
    userValues.email = email;
  }
  if (Object.hasOwn(body, 'phone')) {
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    if (phone.length > 20) throw makeError('Số điện thoại tối đa 20 ký tự', 400);
    userValues.phone = phone || null;
  }
  if (Object.hasOwn(body, 'searchStatus')) {
    if (user.role !== 'candidate') throw makeError('Chỉ ứng viên mới có cài đặt trạng thái tìm việc', 403);
    if (typeof body.searchStatus !== 'boolean') throw makeError('searchStatus phải là true hoặc false', 400);
    userValues.searchStatus = body.searchStatus;
  }

  const profileKeys = ['title', 'location', 'experience', 'skills'];
  if (profileKeys.some((key) => Object.hasOwn(body, key))) {
    if (user.role !== 'candidate') throw makeError('Chỉ ứng viên mới được cập nhật hồ sơ nghề nghiệp', 403);
    for (const [key, max] of [['title', 200], ['location', 200], ['experience', 100]]) {
      if (!Object.hasOwn(body, key)) continue;
      const value = typeof body[key] === 'string' ? body[key].trim() : '';
      if (value.length > max) throw makeError(`${key} tối đa ${max} ký tự`, 400);
      profileValues[key] = value || null;
    }
    if (Object.hasOwn(body, 'skills')) {
      const rawSkills = Array.isArray(body.skills)
        ? body.skills
        : (typeof body.skills === 'string' ? body.skills.split(',') : null);
      if (!rawSkills || rawSkills.some((skill) => typeof skill !== 'string')) {
        throw makeError('skills phải là danh sách kỹ năng hợp lệ', 400);
      }
      const skills = [...new Set(rawSkills.map((skill) => skill.trim()).filter(Boolean))];
      if (skills.length > 30 || skills.some((skill) => skill.length > 80)) {
        throw makeError('Tối đa 30 kỹ năng, mỗi kỹ năng không quá 80 ký tự', 400);
      }
      profileValues.skills = JSON.stringify(skills);
    }
  }
  if (!Object.keys(userValues).length && !Object.keys(profileValues).length) {
    throw makeError('Không có trường hợp hợp lệ để cập nhật', 400);
  }

  try {
    const row = await repository.updateProfile(user.id, userValues, profileValues);
    if (!row) return { user: undefined };
    const profile = row.candidateProfile;
    let skills = [];
    if (profile?.skills) {
      try { skills = JSON.parse(profile.skills); } catch (_) { skills = []; }
    }
    return {
      user: {
        id: Number(row.id),
        email: row.email,
        fullName: row.fullName,
        role: row.role,
        phone: row.phone,
        searchStatus: row.searchStatus,
        title: profile?.title ?? null,
        location: profile?.location ?? null,
        experience: profile?.experience ?? null,
        skills,
      },
    };
  } catch (error) {
    if (isEmailConflict(error)) throw makeError('Email đã được sử dụng', 409);
    throw error;
  }
}

async function changePassword(userId, body) {
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
  if (!currentPassword || newPassword.length < 8 || newPassword.length > 128) {
    throw makeError('Mật khẩu mới phải từ 8 đến 128 ký tự', 400);
  }

  const user = await repository.findPasswordHash(userId);
  let matches = false;
  if (user?.passwordHash) {
    try { matches = await argon2.verify(user.passwordHash, currentPassword); } catch (_) { matches = false; }
  }
  if (!matches) throw makeError('Mật khẩu hiện tại không đúng', 400);

  const hash = await argon2.hash(newPassword, { type: argon2.argon2id });
  await repository.updatePasswordHash(userId, hash);
  return { ok: true };
}

module.exports = { updateProfile, changePassword };
