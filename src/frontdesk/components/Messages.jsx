/**
 * Frontdesk Messages page — wraps the shared owner Messages component with
 * the frontdesk Sidebar layout. Both owner and frontdesk staff use the same
 * /api/admin/messages endpoint (covered by the `staff` middleware which allows
 * both `owner` and `front_desk` roles), so no duplication is needed.
 */
import Sidebar from './Layout/Sidebar';
import AdminMessages from '../../pages/owner/Messages';

export default function FDMessages() {
  return (
    <Sidebar>
      <AdminMessages />
    </Sidebar>
  );
}
