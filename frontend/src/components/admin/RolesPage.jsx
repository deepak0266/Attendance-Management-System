import React from 'react';
import RoleManagement from './RoleManagement';
import RoleDeletionApprovals from './RoleDeletionApprovals';
import { useAuth } from '../../services/auth';

const RolesPage = () => {
  const { user } = useAuth();

  return (
    <div>
      {user?.role === 'SUPER_ADMIN' && <RoleDeletionApprovals />}
      <RoleManagement />
    </div>
  );
};

export default RolesPage;
