import { Box } from '@mui/material';

import InfoListCard, { type InfoListCardProps } from './InfoListCard';

interface InfoListItem extends InfoListCardProps {
  key: string;
}

interface InfoListProps {
  items: InfoListItem[];
}

export default function InfoList({ items }: InfoListProps) {
  return (
    <Box
      component="ul"
      sx={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2.5 }}
    >
      {items.map(({ key, ...cardProps }) => (
        <Box key={key} component="li">
          <InfoListCard {...cardProps} />
        </Box>
      ))}
    </Box>
  );
}
