// Meme.jsx
import React from "react";
import { Card, styled, Box, Typography } from "@mui/material";
import ImageIcon from '@mui/icons-material/Image';
import VideocamIcon from '@mui/icons-material/Videocam';
import DescriptionIcon from '@mui/icons-material/Description';
import LinkIcon from '@mui/icons-material/Link';

const StyledCard = styled(Card)({
    position: "relative",
    transition: "transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out",
    marginBottom: "30px",
    marginRight: "30px",
    overflow: "hidden",
    flex: "1 0 calc(25% - 60px)",
    height: "300px",
    display: "flex",
    flexDirection: "column",

    "&:hover": {
        transform: "scale(1.05)",
        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
        zIndex: 1,
    },
});

const IconWrapper = styled(Box)({
    position: "absolute",
    top: "10px",
    right: "10px",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: "50%",
    padding: "5px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    zIndex: 2,
});

const ContentWrapper = styled(Box)({
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#f5f5f5",
});

const Meme = ({ meme, onClick }) => {
    const { data } = meme;
    
    const handleClick = () => {
        onClick(meme);
    };

    const getMediaType = (data) => {
        if (data.is_video || data.post_hint === 'hosted:video') return 'video';
        if (data.post_hint === 'rich:video') return 'rich:video';
        if (data.post_hint === 'image' || (data.url && data.url.match(/\.(jpeg|jpg|gif|png|webp)$/i))) return 'image';
        if (data.is_self || data.post_hint === 'self') return 'text';
        return 'link';
    };

    const mediaType = getMediaType(data);

    const renderIcon = () => {
        switch (mediaType) {
            case 'video':
            case 'rich:video':
                return <VideocamIcon />;
            case 'image':
                return <ImageIcon />;
            case 'text':
                return <DescriptionIcon />;
            default:
                return <LinkIcon />;
        }
    };

    const renderContent = () => {
        switch (mediaType) {
            case 'video':
                return (
                    <video 
                        src={data.media?.reddit_video?.fallback_url || data.url} 
                        controls 
                        muted 
                        style={{ width: "100%", height: "100%", objectFit: "contain" }} 
                        onClick={(e) => e.stopPropagation()}
                    />
                );
            case 'rich:video':
                 return (
                    <img
                        src={data.thumbnail && data.thumbnail !== 'default' && data.thumbnail !== 'self' ? data.thumbnail : 'https://via.placeholder.com/300?text=Video'}
                        alt={data.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                 );
            case 'image':
                return (
                    <img
                        src={data.url}
                        alt={data.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                );
            case 'text':
                return (
                    <Box p={2} style={{ overflowY: 'auto', maxHeight: '100%', width: '100%' }}>
                        <Typography variant="h6" gutterBottom style={{fontSize: '1rem', fontWeight: 'bold'}}>{data.title}</Typography>
                        <Typography variant="body2" color="textSecondary">
                            {data.selftext ? (data.selftext.length > 150 ? data.selftext.substring(0, 150) + '...' : data.selftext) : ''}
                        </Typography>
                    </Box>
                );
            default:
                return (
                     <Box p={2} textAlign="center" display="flex" flexDirection="column" alignItems="center">
                        <Typography variant="body1" gutterBottom style={{fontSize: '0.9rem'}}>{data.title}</Typography>
                        <LinkIcon style={{ fontSize: 40, margin: '10px 0' }} />
                        <Typography variant="caption" display="block">{data.domain}</Typography>
                    </Box>
                );
        }
    };

    return (
        <StyledCard onClick={handleClick}>
            <IconWrapper>
                {renderIcon()}
            </IconWrapper>
            <ContentWrapper>
                {renderContent()}
            </ContentWrapper>
        </StyledCard>
    );
};

export default Meme;
