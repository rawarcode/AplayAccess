/**
 * Frontdesk Messages page — wraps the shared AdminMessages component with the
 * frontdesk Sidebar layout. Both admin and frontdesk staff use the same
 * /api/admin/messages endpoint (covered by the `staff` middleware which allows
 * both `admin` and `front_desk` roles), so no duplication is needed.
 */
import Sidebar from './Layout/Sidebar';
import AdminMessages from '../../pages/admin/Messages';

export default function FDMessages() {
  return (
    <Sidebar>
      <AdminMessages />
    </Sidebar>
  );
}
